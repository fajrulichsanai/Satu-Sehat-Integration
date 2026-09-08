import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BillingsService } from '../billings.service';
import { Billing, BillingStatus } from '../entities/billing.entity';
import {
  BillingItem,
  DiscountType,
} from '../../billing-item/entities/billing-item.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { GudangService } from '../../gudang/gudang.service';
import { PatientRecallsService } from '../../recalls/patient-recalls.service';

describe('BillingsService', () => {
  let service: BillingsService;

  const mockBillingRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const mockBillingItemRepository = {};
  const mockTarifRepository = {};
  const mockEncounterRepository = { findOne: jest.fn() };
  const mockGudangService = {
    deductForTindakan: jest.fn(),
    restoreForTindakan: jest.fn(),
  };
  const mockPatientRecallsService = {
    scheduleFromBillingItems: jest.fn(),
  };

  // Minimal manager stub simulating TypeORM's transactional EntityManager.
  const manager = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingsService,
        {
          provide: getRepositoryToken(Billing),
          useValue: mockBillingRepository,
        },
        {
          provide: getRepositoryToken(BillingItem),
          useValue: mockBillingItemRepository,
        },
        { provide: getRepositoryToken(Tarif), useValue: mockTarifRepository },
        {
          provide: getRepositoryToken(Encounter),
          useValue: mockEncounterRepository,
        },
        { provide: GudangService, useValue: mockGudangService },
        {
          provide: PatientRecallsService,
          useValue: mockPatientRecallsService,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<BillingsService>(BillingsService);
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation((cb: any) => cb(manager));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('throws NotFoundException when billing does not exist for the clinic (negative)', async () => {
      mockBillingRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('returns the billing when found (positive)', async () => {
      const billing = { id: 1, clinicId: 1 };
      mockBillingRepository.findOne.mockResolvedValue(billing);

      await expect(service.findOne(1, 1)).resolves.toBe(billing);
    });
  });

  describe('create', () => {
    const clinicId = 1;
    const userId = 10;
    const dto = {
      encounterId: 1,
      items: [{ name: 'Cabut gigi', unitPrice: 100000, quantity: 1 }],
    } as any;

    it('rejects when the encounter does not exist for the clinic (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue(null);

      await expect(service.create(clinicId, dto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when the encounter already has an active billing (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        patientId: 5,
      });
      mockBillingRepository.findOne.mockResolvedValue({
        id: 99,
        status: BillingStatus.UNPAID,
      });

      await expect(service.create(clinicId, dto, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows creating a new billing when the previous one for the encounter was cancelled (positive)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        patientId: 5,
      });
      mockBillingRepository.findOne.mockResolvedValue({
        id: 99,
        status: BillingStatus.CANCELLED,
      });
      manager.save.mockImplementation((entity: any, data: any) => {
        if (entity === Billing) return Promise.resolve({ id: 1, ...data });
        return Promise.resolve(data);
      });

      const result = await service.create(clinicId, dto, userId);

      expect((result as any).grandTotal).toBe(100000);
      expect((result as any).status).toBe(BillingStatus.UNPAID);
    });

    it('rejects when an item references a tarif that does not exist (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        patientId: 5,
      });
      mockBillingRepository.findOne.mockResolvedValue(null);
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          clinicId,
          {
            encounterId: 1,
            items: [{ tarifId: 999, name: 'X', unitPrice: 1000, quantity: 1 }],
          } as any,
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a nominal discount above the tarif max discount (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        patientId: 5,
      });
      mockBillingRepository.findOne.mockResolvedValue(null);
      manager.findOne.mockResolvedValue({
        id: 1,
        name: 'Cabut gigi',
        diskonMaksimal: 5000,
        hargaJual: 100000,
      });

      await expect(
        service.create(
          clinicId,
          {
            encounterId: 1,
            items: [
              {
                tarifId: 1,
                name: 'Cabut gigi',
                unitPrice: 100000,
                quantity: 1,
                discount: 10000,
                discountType: DiscountType.NOMINAL,
              },
            ],
          } as any,
          userId,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('creates a billing and deducts stock for tarif-linked items (positive)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        patientId: 5,
      });
      mockBillingRepository.findOne.mockResolvedValue(null);
      manager.findOne.mockResolvedValue({
        id: 1,
        name: 'Cabut gigi',
        diskonMaksimal: 50000,
        hargaJual: 100000,
      });
      manager.save.mockImplementation((entity: any, data: any) => {
        if (entity === Billing) return Promise.resolve({ id: 1, ...data });
        if (entity === BillingItem)
          return Promise.resolve(
            (data as any[]).map((d, i) => ({ id: i + 1, ...d })),
          );
        return Promise.resolve(data);
      });

      const result = await service.create(
        clinicId,
        {
          encounterId: 1,
          items: [
            {
              tarifId: 1,
              name: 'Cabut gigi',
              unitPrice: 100000,
              quantity: 2,
            },
          ],
        },
        userId,
      );

      expect((result as any).grandTotal).toBe(200000);
      expect(mockGudangService.deductForTindakan).toHaveBeenCalledWith(
        manager,
        clinicId,
        1,
        2,
        userId,
      );
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when the billing does not exist (negative)', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(service.cancel(1, 1, 10)).rejects.toThrow(NotFoundException);
    });

    it('rejects cancelling an already-cancelled billing (negative)', async () => {
      manager.findOne.mockResolvedValue({
        id: 1,
        status: BillingStatus.CANCELLED,
        paidAmount: 0,
        items: [],
      });

      await expect(service.cancel(1, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects cancelling a billing that already has a payment (negative)', async () => {
      manager.findOne.mockResolvedValue({
        id: 1,
        status: BillingStatus.PARTIAL,
        paidAmount: 50000,
        items: [],
      });

      await expect(service.cancel(1, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cancels an unpaid billing and restores stock for its items (positive)', async () => {
      const billing = {
        id: 1,
        status: BillingStatus.UNPAID,
        paidAmount: 0,
        items: [{ tarifId: 1, quantity: 2 }],
      };
      manager.findOne.mockResolvedValue(billing);
      manager.save.mockResolvedValue(billing);

      const result = await service.cancel(1, 1, 10);

      expect(result.status).toBe(BillingStatus.CANCELLED);
      expect(mockGudangService.restoreForTindakan).toHaveBeenCalledWith(
        manager,
        1,
        1,
        2,
        10,
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the billing does not exist (negative)', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.update(1, 1, { notes: 'x' } as any, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects editing a cancelled billing (negative)', async () => {
      manager.findOne.mockResolvedValue({
        id: 1,
        status: BillingStatus.CANCELLED,
      });

      await expect(
        service.update(1, 1, { notes: 'x' } as any, 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks the billing as PAID once the outstanding amount reaches zero (positive)', async () => {
      const billing = {
        id: 1,
        status: BillingStatus.UNPAID,
        subtotal: 100000,
        totalDiscount: 0,
        additionalFee: 0,
        grandTotal: 100000,
        paidAmount: 100000,
        outstandingAmount: 0,
      };
      manager.findOne
        .mockResolvedValueOnce(billing)
        .mockResolvedValueOnce({ ...billing, status: BillingStatus.PAID });
      manager.save.mockResolvedValue(billing);

      await service.update(1, 1, {}, 10);

      expect(billing.status).toBe(BillingStatus.PAID);
      expect(billing.outstandingAmount).toBe(0);
    });
  });
});

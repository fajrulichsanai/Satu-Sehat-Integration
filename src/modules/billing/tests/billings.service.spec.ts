import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BillingsService } from '../billings.service';
import { Billing, BillingStatus } from '../entities/billing.entity';
import { BillingItem, DiscountType } from '../../billing-item/entities/billing-item.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { GudangService } from '../../gudang/gudang.service';
import { PatientRecallsService } from '../../recalls/patient-recalls.service';

function buildQb(result: [any[], number] = [[], 0]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
}

describe('BillingsService', () => {
  let service: BillingsService;
  let billingRepo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let encounterRepo: { findOne: jest.Mock };
  let gudangService: { deductForTindakan: jest.Mock; restoreForTindakan: jest.Mock };
  let recallsService: { scheduleFromBillingItems: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let manager: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };

  const clinicId = 1;
  const userId = 9;

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      save: jest.fn((a: any, b?: any) => {
        if (b !== undefined) {
          return Array.isArray(b)
            ? Promise.resolve(b.map((x, i) => ({ id: i + 1, ...x })))
            : Promise.resolve({ id: 1, ...b });
        }
        return Promise.resolve(a);
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    billingRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
    };
    encounterRepo = { findOne: jest.fn() };
    gudangService = {
      deductForTindakan: jest.fn().mockResolvedValue(undefined),
      restoreForTindakan: jest.fn().mockResolvedValue(undefined),
    };
    recallsService = {
      scheduleFromBillingItems: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((cb: any) => cb(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingsService,
        { provide: getRepositoryToken(Billing), useValue: billingRepo },
        { provide: getRepositoryToken(BillingItem), useValue: {} },
        { provide: getRepositoryToken(Tarif), useValue: {} },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: GudangService, useValue: gudangService },
        { provide: PatientRecallsService, useValue: recallsService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<BillingsService>(BillingsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findOne', () => {
    it('returns billing with relations when found (positive)', async () => {
      billingRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      const result = await service.findOne(1, clinicId);
      expect(result).toEqual({ id: 1, clinicId });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      billingRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, clinicId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const dto = {
      encounterId: 5,
      items: [
        { tarifId: 1, name: 'Tambal gigi', quantity: 1, unitPrice: 100000 },
      ],
    } as any;

    const tarif = { id: 1, clinicId, name: 'Tambal gigi', diskonMaksimal: 20000, hargaJual: 100000 };

    beforeEach(() => {
      encounterRepo.findOne.mockResolvedValue({ id: 5, clinicId, patientId: 3 });
      billingRepo.findOne.mockResolvedValue(null);
      manager.findOne.mockImplementation((entity: any) => {
        if (entity === Tarif) return Promise.resolve(tarif);
        return Promise.resolve(null);
      });
    });

    it('creates a billing, deducts stock and schedules recall (positive)', async () => {
      const result = await service.create(clinicId, dto, userId);

      expect(gudangService.deductForTindakan).toHaveBeenCalledWith(
        manager,
        clinicId,
        1,
        1,
        userId,
      );
      expect(recallsService.scheduleFromBillingItems).toHaveBeenCalled();
      expect(result.subtotal).toBe(100000);
      expect(result.status).toBe(BillingStatus.UNPAID);
      expect(result.outstandingAmount).toBe(result.grandTotal);
    });

    it('applies a nominal total discount and additional fee correctly (positive)', async () => {
      const result = await service.create(
        clinicId,
        { ...dto, totalDiscount: 10000, additionalFee: 5000 },
        userId,
      );
      expect(result.totalDiscount).toBe(10000);
      expect(result.grandTotal).toBe(100000 - 10000 + 5000);
    });

    it('applies a percentage total discount correctly (positive)', async () => {
      const result = await service.create(
        clinicId,
        { ...dto, totalDiscount: 10, totalDiscountType: DiscountType.PERCENT },
        userId,
      );
      expect(result.totalDiscount).toBe(10000); // 10% of 100000
    });

    it('does not fail billing creation when recall scheduling throws (negative/edge)', async () => {
      recallsService.scheduleFromBillingItems.mockRejectedValue(
        new Error('recall service down'),
      );
      await expect(
        service.create(clinicId, dto, userId),
      ).resolves.toMatchObject({ status: BillingStatus.UNPAID });
    });

    it('throws NotFoundException when encounter does not exist (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.create(clinicId, dto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when an active billing already exists for the encounter (negative)', async () => {
      billingRepo.findOne.mockResolvedValue({
        id: 2,
        status: BillingStatus.UNPAID,
      });
      await expect(service.create(clinicId, dto, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows creating a new billing when the previous one was CANCELLED (positive/edge)', async () => {
      billingRepo.findOne.mockResolvedValue({
        id: 2,
        status: BillingStatus.CANCELLED,
      });
      await expect(
        service.create(clinicId, dto, userId),
      ).resolves.toMatchObject({ status: BillingStatus.UNPAID });
    });

    it('throws NotFoundException when a referenced tarif does not exist (negative)', async () => {
      manager.findOne.mockImplementation((entity: any) =>
        entity === Tarif ? Promise.resolve(null) : Promise.resolve(null),
      );
      await expect(service.create(clinicId, dto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnprocessableEntityException when nominal discount exceeds tarif max (negative)', async () => {
      await expect(
        service.create(
          clinicId,
          {
            ...dto,
            items: [{ ...dto.items[0], discount: 50000 }],
          },
          userId,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when percent discount exceeds tarif max (negative)', async () => {
      await expect(
        service.create(
          clinicId,
          {
            ...dto,
            items: [
              {
                ...dto.items[0],
                discount: 50,
                discountType: DiscountType.PERCENT,
              },
            ],
          },
          userId,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('does not deduct stock for a free-text item without tarifId (edge)', async () => {
      await service.create(
        clinicId,
        { encounterId: 5, items: [{ name: 'Jasa umum', quantity: 1, unitPrice: 20000 }] },
        userId,
      );
      expect(gudangService.deductForTindakan).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels an unpaid billing and restores stock (positive)', async () => {
      manager.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: BillingStatus.UNPAID,
        paidAmount: 0,
        items: [{ tarifId: 1, quantity: 2 }],
      });

      const result = await service.cancel(1, clinicId, userId);

      expect(gudangService.restoreForTindakan).toHaveBeenCalledWith(
        manager,
        clinicId,
        1,
        2,
        userId,
      );
      expect(result.status).toBe(BillingStatus.CANCELLED);
    });

    it('throws NotFoundException when billing is missing (negative)', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.cancel(999, clinicId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when already cancelled (negative)', async () => {
      manager.findOne.mockResolvedValue({
        id: 1,
        status: BillingStatus.CANCELLED,
        paidAmount: 0,
        items: [],
      });
      await expect(service.cancel(1, clinicId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when billing already has a payment (negative)', async () => {
      manager.findOne.mockResolvedValue({
        id: 1,
        status: BillingStatus.PARTIAL,
        paidAmount: 50000,
        items: [],
      });
      await expect(service.cancel(1, clinicId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('recomputes grandTotal and marks PAID when outstanding drops to zero (positive)', async () => {
      const billing = {
        id: 1,
        clinicId,
        status: BillingStatus.UNPAID,
        subtotal: 100000,
        totalDiscount: 0,
        additionalFee: 0,
        paidAmount: 100000,
        notes: null,
      };
      manager.findOne.mockResolvedValueOnce(billing).mockResolvedValueOnce({
        ...billing,
        status: BillingStatus.PAID,
      });

      const result = await service.update(1, clinicId, { additionalFee: 0 } as any, userId);

      expect(billing.status).toBe(BillingStatus.PAID);
      expect(billing.outstandingAmount).toBe(0);
    });

    it('marks PARTIAL when some payment exists but outstanding remains (positive)', async () => {
      const billing = {
        id: 1,
        clinicId,
        status: BillingStatus.UNPAID,
        subtotal: 100000,
        totalDiscount: 0,
        additionalFee: 0,
        paidAmount: 30000,
        notes: null,
      };
      manager.findOne.mockResolvedValueOnce(billing).mockResolvedValueOnce(billing);

      await service.update(1, clinicId, {} as any, userId);

      expect(billing.status).toBe(BillingStatus.PARTIAL);
      expect(billing.outstandingAmount).toBe(70000);
    });

    it('throws NotFoundException when billing is missing (negative)', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, clinicId, {} as any, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when billing is CANCELLED (negative)', async () => {
      manager.findOne.mockResolvedValue({
        id: 1,
        status: BillingStatus.CANCELLED,
      });
      await expect(
        service.update(1, clinicId, {} as any, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('applies clinic scope and default pagination (positive)', async () => {
      const qb = buildQb();
      billingRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(clinicId, {} as any);

      expect(qb.where).toHaveBeenCalledWith('b.clinicId = :clinicId', {
        clinicId,
      });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('applies status/date/patient filters when provided (positive)', async () => {
      const qb = buildQb();
      billingRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(clinicId, {
        status: BillingStatus.PAID,
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        patientId: 3,
      } as any);

      expect(qb.andWhere).toHaveBeenCalledWith('b.status = :status', {
        status: BillingStatus.PAID,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('b.patientId = :patientId', {
        patientId: 3,
      });
    });
  });
});

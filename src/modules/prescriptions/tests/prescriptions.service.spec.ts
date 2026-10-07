import { PrescriptionReview } from '../entities/prescription-review.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PrescriptionsService } from '../prescriptions.service';
import { PrescriptionItem } from '../entities/prescription-item.entity';
import { PrescriptionSignature } from '../entities/prescription-signature.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { SatusehatResourceLink } from '../../satusehat/sync/entities/satusehat-resource-link.entity';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let itemRepo: {
    find: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findOne?: jest.Mock;
  };
  let encounterRepo: { findOne: jest.Mock };
  let linkRepo: { exists: jest.Mock };
  let signatureRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    itemRepo = {
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      delete: jest.fn(),
    };
    encounterRepo = { findOne: jest.fn() };
    linkRepo = { exists: jest.fn().mockResolvedValue(false) };
    signatureRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve(d)),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: getRepositoryToken(PrescriptionItem), useValue: itemRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        {
          provide: getRepositoryToken(SatusehatResourceLink),
          useValue: linkRepo,
        },
        {
          provide: getRepositoryToken(PrescriptionSignature),
          useValue: signatureRepo,
        },
        {
          provide: getRepositoryToken(PrescriptionReview),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((d) => d),
            save: jest.fn((d) => d),
          },
        },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('listByEncounter', () => {
    it('lists items ordered by sortOrder for a valid encounter (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.listByEncounter(1, 1);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.listByEncounter(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('appends a new item with sortOrder equal to the current count (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.count.mockResolvedValue(2);

      const result = await service.create(
        1,
        1,
        { drugName: 'Paracetamol' } as any,
        9,
      );

      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 2, createdBy: 9 }),
      );
      expect(result.drugName).toBe('Paracetamol');
    });

    it('starts sortOrder at 0 for the first item (positive/edge)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.count.mockResolvedValue(0);
      await service.create(1, 1, { drugName: 'X' } as any, 9);
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 0 }),
      );
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.create(999, 1, {} as any, 9)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the item when found (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.remove(1, 1, 5)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the item does not exist (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove(1, 1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 99, 5)).rejects.toThrow(NotFoundException);
      expect(itemRepo.delete).not.toHaveBeenCalled();
    });

    it('refuses to delete an item already sent to SATUSEHAT (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      linkRepo.exists.mockResolvedValue(true);
      await expect(service.remove(1, 1, 5)).rejects.toThrow('sudah terkirim');
      expect(itemRepo.delete).not.toHaveBeenCalled();
    });
  });
  describe('setCoding', () => {
    const freeText = {
      id: 7,
      encounterId: 1,
      drugName: 'Asam Mefenamat 500 mg',
      kfaCode: null,
      compoundType: null,
      routeCode: null,
    };
    beforeEach(() => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.findOne = jest.fn().mockResolvedValue({ ...freeText });
    });

    it('attaches a KFA product to a free-text drug (positive)', async () => {
      const res = await service.setCoding(
        1,
        1,
        7,
        { kfaCode: '93001019', kfaName: 'Asam Mefenamat 500 mg Tablet' },
        9,
      );
      expect(res).toMatchObject({
        kfaCode: '93001019',
        compoundType: null,
        ingredients: null,
        updatedBy: 9,
      });
    });

    it('turns the item into a racikan and clears the product code (edge)', async () => {
      itemRepo.findOne!.mockResolvedValue({ ...freeText, kfaCode: '93001019' });
      const ingredients = [
        {
          kfaCode: '91000101',
          name: 'Mefenamic acid',
          amount: 250,
          amountUnit: 'mg' as const,
          perAmount: 1,
          perUnit: 'CAP' as const,
        },
      ];
      const res = await service.setCoding(
        1,
        1,
        7,
        {
          compoundType: 'SD',
          compoundFormCode: 'BS019',
          compoundFormName: 'Kapsul',
          compoundUnit: 'CAP',
          routeCode: 'O',
          ingredients,
        },
        9,
      );
      expect(res).toMatchObject({
        kfaCode: null,
        compoundType: 'SD',
        compoundFormCode: 'BS019',
        routeCode: 'O',
        ingredients,
      });
    });

    it('rejects an empty fix and items of another clinic (negative)', async () => {
      await expect(service.setCoding(1, 1, 7, {}, 9)).rejects.toThrow(
        'Pilih produk KFA',
      );
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(
        service.setCoding(1, 99, 7, { kfaCode: '93001019' }, 9),
      ).rejects.toThrow(NotFoundException);
      expect(itemRepo.save).not.toHaveBeenCalled();
    });
  });
  describe('resep sederhana & tanda tangan', () => {
    it('stores numero/signa and fills the legacy quantity/frequency columns (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.count.mockResolvedValue(0);
      const res = await service.create(
        1,
        1,
        {
          drugName: 'Amoxicillin',
          dosage: '500 mg',
          dosageForm: 'Kapsul',
          numero: 15,
          signa: {
            timesPerDay: 3,
            amount: 1,
            unit: 'CAP',
            when: 'PC',
            route: 'O',
            latin: 'S 3 dd caps I p.c.',
            text: '3 x sehari 1 kapsul sesudah makan',
          },
        },
        9,
      );
      expect(res).toMatchObject({
        numero: 15,
        quantity: '15',
        frequency: '3 x sehari 1 kapsul sesudah makan',
        routeCode: 'O',
      });
    });

    it('saves the signature once per encounter and updates it on re-sign (edge)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      await service.saveSignature(
        1,
        1,
        { signature: 'data:image/png;base64,AAAA' },
        9,
      );
      signatureRepo.findOne.mockResolvedValue({
        id: 5,
        encounterId: 1,
        signature: 'old',
      });
      const res = await service.saveSignature(
        1,
        1,
        { signature: 'data:image/png;base64,BBBB' },
        9,
      );
      expect(res.signature).toBe('data:image/png;base64,BBBB');
      expect(signatureRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: 5,
          signature: 'data:image/png;base64,BBBB',
        }),
      );
    });

    it('refuses signatures for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(
        service.saveSignature(
          1,
          99,
          { signature: 'data:image/png;base64,AAAA' },
          9,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(signatureRepo.save).not.toHaveBeenCalled();
    });
  });
});

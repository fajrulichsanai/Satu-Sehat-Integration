import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DoctorFeeService } from '../doctor-fee.service';
import { DoctorFeeConfig } from '../entities/doctor-fee-config.entity';

describe('DoctorFeeService', () => {
  let service: DoctorFeeService;
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorFeeService,
        { provide: getRepositoryToken(DoctorFeeConfig), useValue: repo },
      ],
    }).compile();

    service = module.get<DoctorFeeService>(DoctorFeeService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('listConfigs', () => {
    it('maps configs with tarif name and numeric feeValue (positive)', async () => {
      repo.find.mockResolvedValue([
        {
          id: 1,
          tarifId: 5,
          tarif: { name: 'Cabut Gigi' },
          feeType: 'percent',
          feeValue: '10.00',
          isActive: true,
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listConfigs(1);

      expect(result.data[0].tarifName).toBe('Cabut Gigi');
      expect(result.data[0].feeValue).toBe(10);
      expect(typeof result.data[0].feeValue).toBe('number');
    });

    it('falls back to empty tarifName when tarif relation is missing (negative/edge)', async () => {
      repo.find.mockResolvedValue([
        {
          id: 1,
          tarifId: 5,
          tarif: null,
          feeType: 'nominal',
          feeValue: '5000',
          isActive: true,
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listConfigs(1);
      expect(result.data[0].tarifName).toBe('');
    });

    it('returns an empty list when the clinic has no configs (negative/edge)', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.listConfigs(1);
      expect(result.data).toEqual([]);
    });
  });

  describe('upsertConfig', () => {
    it('creates a new config defaulting isActive to true (positive)', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.upsertConfig(
        { tarifId: 5, feeType: 'percent', feeValue: 10 } as any,
        1,
        9,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, createdBy: 9 }),
      );
      expect(result.success).toBe(true);
    });

    it('updates an existing config, preserving isActive when omitted (positive)', async () => {
      const existing = {
        id: 1,
        clinicId: 1,
        tarifId: 5,
        feeType: 'nominal',
        feeValue: 5000,
        isActive: false,
      };
      repo.findOne.mockResolvedValue(existing);

      await service.upsertConfig(
        { tarifId: 5, feeType: 'percent', feeValue: 15 } as any,
        1,
        9,
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          feeType: 'percent',
          feeValue: 15,
          isActive: false,
          updatedBy: 9,
        }),
      );
    });

    it('overrides isActive when explicitly provided (edge)', async () => {
      const existing = {
        id: 1,
        clinicId: 1,
        tarifId: 5,
        isActive: false,
      };
      repo.findOne.mockResolvedValue(existing);

      await service.upsertConfig(
        { tarifId: 5, feeType: 'nominal', feeValue: 1000, isActive: true } as any,
        1,
        9,
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });
  });
});

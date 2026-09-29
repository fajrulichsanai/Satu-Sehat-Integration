import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TreatmentPlansService } from '../treatment-plans.service';
import { TreatmentPlan } from '../entities/treatment-plan.entity';
import { TreatmentPlanSession } from '../entities/treatment-plan-session.entity';
import { TreatmentPlanStatus } from '../../../enums';

describe('TreatmentPlansService', () => {
  let service: TreatmentPlansService;
  let planRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let sessionRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    planRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    sessionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreatmentPlansService,
        { provide: getRepositoryToken(TreatmentPlan), useValue: planRepo },
        { provide: getRepositoryToken(TreatmentPlanSession), useValue: sessionRepo },
      ],
    }).compile();

    service = module.get<TreatmentPlansService>(TreatmentPlansService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findOne', () => {
    it('returns the plan when found (positive)', async () => {
      planRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      const result = await service.findOne(1, 1);
      expect(result).toEqual({ id: 1, clinicId: 1 });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findSessions', () => {
    it('lists sessions ordered by stage for a valid plan (positive)', async () => {
      planRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      sessionRepo.find.mockResolvedValue([{ id: 1, stageNumber: 1 }]);
      const result = await service.findSessions(1, 1);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for a plan outside the clinic (negative)', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(service.findSessions(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a plan starting at stage 0 (positive)', async () => {
      const result = await service.create(
        1,
        { patientId: 5, treatmentType: 'ortho', totalStages: 3 } as any,
        9,
      );
      expect(result.currentStage).toBe(0);
    });
  });

  describe('update', () => {
    it('merges provided fields into the plan (positive)', async () => {
      planRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1, label: 'Old' });
      const result = await service.update(1, 1, { label: 'New' } as any, 9);
      expect(result.label).toBe('New');
    });

    it('throws NotFoundException when the plan is missing (negative)', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addSession', () => {
    it('advances currentStage by one and keeps the plan ACTIVE when stages remain (positive)', async () => {
      planRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        currentStage: 0,
        totalStages: 3,
      });

      await service.addSession(1, 1, { date: '2026-01-01' } as any, 9);

      expect(planRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStage: 1 }),
      );
      expect(planRepo.save.mock.calls[0][0].status).toBeUndefined();
    });

    it('marks the plan COMPLETED once currentStage reaches totalStages (positive)', async () => {
      planRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        currentStage: 2,
        totalStages: 3,
      });

      await service.addSession(1, 1, { date: '2026-01-01' } as any, 9);

      expect(planRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStage: 3,
          status: TreatmentPlanStatus.COMPLETED,
        }),
      );
    });

    it('assigns stageNumber sequentially based on the plan’s current stage (positive)', async () => {
      planRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        currentStage: 4,
        totalStages: 10,
      });

      const result = await service.addSession(
        1,
        1,
        { date: '2026-01-01' } as any,
        9,
      );

      expect(result.stageNumber).toBe(5);
    });

    it('does not mark COMPLETED when totalStages is not set (open-ended plan) (negative/edge)', async () => {
      planRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        currentStage: 0,
        totalStages: null,
      });

      await service.addSession(1, 1, { date: '2026-01-01' } as any, 9);

      const savedPlan = planRepo.save.mock.calls[0][0];
      expect(savedPlan.status).toBeUndefined();
    });

    it('throws NotFoundException when the plan does not exist (negative)', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addSession(999, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSession', () => {
    it('merges fields into an existing session (positive)', async () => {
      planRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      sessionRepo.findOne.mockResolvedValue({
        id: 5,
        treatmentPlanId: 1,
        notes: 'Old',
      });

      const result = await service.updateSession(
        5,
        1,
        1,
        { notes: 'New' } as any,
        9,
      );

      expect(result.notes).toBe('New');
    });

    it('throws NotFoundException when the session does not exist (negative)', async () => {
      planRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateSession(999, 1, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the parent plan does not exist (negative)', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateSession(1, 999, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
      expect(sessionRepo.findOne).not.toHaveBeenCalled();
    });
  });
});

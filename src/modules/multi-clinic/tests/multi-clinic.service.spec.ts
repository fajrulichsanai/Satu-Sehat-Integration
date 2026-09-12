import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MultiClinicService } from '../multi-clinic.service';
import { OwnerClinicLink } from '../entities/owner-clinic-link.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { DashboardService } from '../../dashboard/dashboard.service';
import { UserRole } from '../../../enums';

describe('MultiClinicService', () => {
  let service: MultiClinicService;
  let linkRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let userRepo: { find: jest.Mock; findOne: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };
  let dashboardService: { getSummary: jest.Mock };

  beforeEach(async () => {
    linkRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    userRepo = { find: jest.fn(), findOne: jest.fn() };
    clinicRepo = { findOne: jest.fn() };
    dashboardService = { getSummary: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiClinicService,
        { provide: getRepositoryToken(OwnerClinicLink), useValue: linkRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: DashboardService, useValue: dashboardService },
      ],
    }).compile();

    service = module.get<MultiClinicService>(MultiClinicService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('listOwners', () => {
    it('groups linked clinics under each owner (positive)', async () => {
      userRepo.find.mockResolvedValue([{ id: 1, name: 'Owner A', email: 'a@x.com', isActive: true }]);
      linkRepo.find.mockResolvedValue([
        { ownerId: 1, clinic: { id: 10, name: 'Klinik A' } },
        { ownerId: 1, clinic: { id: 11, name: 'Klinik B' } },
      ]);

      const result = await service.listOwners();

      expect(result[0].clinics).toHaveLength(2);
    });

    it('returns an empty clinics array for an owner with no links (negative/edge)', async () => {
      userRepo.find.mockResolvedValue([{ id: 2, name: 'Owner B' }]);
      linkRepo.find.mockResolvedValue([]);

      const result = await service.listOwners();

      expect(result[0].clinics).toEqual([]);
    });
  });

  describe('linkClinic', () => {
    it('creates a new link between owner and clinic (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, role: UserRole.MULTI_CLINIC_OWNER });
      clinicRepo.findOne.mockResolvedValue({ id: 10 });
      linkRepo.findOne.mockResolvedValue(null);

      await service.linkClinic(1, 10, 9);

      expect(linkRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 1, clinicId: 10, createdBy: 9 }),
      );
    });

    it('returns the existing link idempotently instead of duplicating it (positive/edge)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, role: UserRole.MULTI_CLINIC_OWNER });
      clinicRepo.findOne.mockResolvedValue({ id: 10 });
      const existing = { id: 99, ownerId: 1, clinicId: 10 };
      linkRepo.findOne.mockResolvedValue(existing);

      const result = await service.linkClinic(1, 10, 9);

      expect(result).toBe(existing);
      expect(linkRepo.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the target user is not a MULTI_CLINIC_OWNER (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, role: UserRole.OWNER });
      await expect(service.linkClinic(1, 10, 9)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the owner does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.linkClinic(999, 10, 9)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when the clinic does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, role: UserRole.MULTI_CLINIC_OWNER });
      clinicRepo.findOne.mockResolvedValue(null);
      await expect(service.linkClinic(1, 999, 9)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unlinkClinic', () => {
    it('deletes the link (positive)', async () => {
      await service.unlinkClinic(1, 10);
      expect(linkRepo.delete).toHaveBeenCalledWith({ ownerId: 1, clinicId: 10 });
    });
  });

  describe('assertOwnsClinic', () => {
    it('resolves without error when the clinic is linked to the owner (positive)', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 1, ownerId: 5, clinicId: 10 });
      await expect(service.assertOwnsClinic(5, 10)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when the clinic is not linked to the owner (negative)', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      await expect(service.assertOwnsClinic(5, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('does not let one multi-klinik owner touch a clinic linked only to a different owner (negative/security)', async () => {
      // The repo is queried with both ownerId AND clinicId — a clinic linked
      // to owner 6 must not pass the check when owner 5 asks for it.
      linkRepo.findOne.mockImplementation(({ where }) =>
        Promise.resolve(
          where.ownerId === 6 && where.clinicId === 10
            ? { id: 1, ownerId: 6, clinicId: 10 }
            : null,
        ),
      );
      await expect(service.assertOwnsClinic(5, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getMyClinics', () => {
    it('returns the clinics linked to the owner in link order (positive)', async () => {
      linkRepo.find.mockResolvedValue([
        { clinic: { id: 10, name: 'A' } },
        { clinic: { id: 11, name: 'B' } },
      ]);
      const result = await service.getMyClinics(1);
      expect(result).toEqual([{ id: 10, name: 'A' }, { id: 11, name: 'B' }]);
    });
  });

  describe('getDashboard', () => {
    it('aggregates totals across all owned clinics (positive)', async () => {
      linkRepo.find.mockResolvedValue([
        { clinic: { id: 10, name: 'A' } },
        { clinic: { id: 11, name: 'B' } },
      ]);
      dashboardService.getSummary
        .mockResolvedValueOnce({
          totalPatients: 5,
          activePractitioners: 1,
          todayVisits: 2,
          monthlyRevenue: 100000,
          totalTransactions: 3,
        })
        .mockResolvedValueOnce({
          totalPatients: 7,
          activePractitioners: 2,
          todayVisits: 1,
          monthlyRevenue: 200000,
          totalTransactions: 4,
        });

      const result = await service.getDashboard(1);

      expect(result.totals).toEqual({
        totalPatients: 12,
        activePractitioners: 3,
        todayVisits: 3,
        monthlyRevenue: 300000,
        totalTransactions: 7,
      });
      expect(result.clinics).toHaveLength(2);
    });

    it('returns zeroed totals when the owner has no clinics (negative/edge)', async () => {
      linkRepo.find.mockResolvedValue([]);
      const result = await service.getDashboard(1);
      expect(result.totals.totalPatients).toBe(0);
      expect(result.clinics).toEqual([]);
    });
  });
});

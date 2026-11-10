import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MultiClinicService } from '../multi-clinic.service';
import {
  BranchBillingMode,
  OwnerClinicLink,
  OwnerClinicLinkStatus,
} from '../entities/owner-clinic-link.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { DashboardService } from '../../dashboard/dashboard.service';
import { ClinicSubscriptionsService } from '../../subscriptions/clinic-subscriptions.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { MultiClinicMailService } from '../multi-clinic-mail.service';
import { UserRole } from '../../../enums';

const DAY = 24 * 60 * 60 * 1000;

describe('MultiClinicService', () => {
  let service: MultiClinicService;
  let linkRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
  let userRepo: { find: jest.Mock; findOne: jest.Mock };
  let clinicRepo: { findOne: jest.Mock; find: jest.Mock };
  let dashboardService: { getSummary: jest.Mock };
  let subscriptions: { getCurrentForClinic: jest.Mock };
  let auditLog: { record: jest.Mock };
  let mail: { linkRequested: jest.Mock; linkAnswered: jest.Mock };
  let dataSource: { query: jest.Mock; manager: { query: jest.Mock } };

  const admin = { userId: 1, name: 'SA', role: UserRole.SUPER_ADMIN };
  const mco = {
    id: 5,
    name: 'Bu Owner',
    email: 'o@x.id',
    role: UserRole.MULTI_CLINIC_OWNER,
  };
  const clinic = { id: 10, name: 'Klinik A' };

  beforeEach(async () => {
    linkRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve({ id: data.id ?? 1, ...data })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    userRepo = {
      find: jest.fn().mockResolvedValue([{ email: 'pemilik@klinik.id' }]),
      findOne: jest.fn().mockResolvedValue(mco),
    };
    clinicRepo = {
      findOne: jest.fn().mockResolvedValue(clinic),
      find: jest.fn(),
    };
    dashboardService = { getSummary: jest.fn() };
    subscriptions = { getCurrentForClinic: jest.fn().mockResolvedValue(null) };
    auditLog = { record: jest.fn() };
    mail = {
      linkRequested: jest.fn().mockResolvedValue(undefined),
      linkAnswered: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
      manager: {
        query: jest.fn().mockResolvedValue([{ branches: 2, used: 7 }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiClinicService,
        { provide: getRepositoryToken(OwnerClinicLink), useValue: linkRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: DashboardService, useValue: dashboardService },
        { provide: DataSource, useValue: dataSource },
        { provide: ClinicSubscriptionsService, useValue: subscriptions },
        { provide: AuditLogService, useValue: auditLog },
        { provide: MultiClinicMailService, useValue: mail },
      ],
    }).compile();

    service = module.get(MultiClinicService);
  });

  describe('requestLink (Super Admin)', () => {
    it('creates a pending request, audits it and emails the clinic owner (positive)', async () => {
      const res = await service.requestLink(5, 10, admin);

      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 5,
          clinicId: 10,
          status: OwnerClinicLinkStatus.PENDING,
          billingMode: BranchBillingMode.OWNER,
          requestedBy: 1,
          respondedAt: null,
        }),
      );
      expect(res.status).toBe(OwnerClinicLinkStatus.PENDING);
      expect(res.expiresAt).toBeInstanceOf(Date);
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'MultiClinicLink',
          clinicId: 10,
          actorId: 1,
        }),
      );
      await new Promise((r) => setImmediate(r));
      expect(mail.linkRequested).toHaveBeenCalledWith(
        ['pemilik@klinik.id'],
        'Klinik A',
        'Bu Owner',
        expect.any(Date),
      );
    });

    it('links a new branch directly without approval (PS-03, positive)', async () => {
      const res = await service.requestLink(5, 10, admin, { direct: true });
      expect(res.status).toBe(OwnerClinicLinkStatus.APPROVED);
      expect(res.expiresAt).toBeNull();
      await new Promise((r) => setImmediate(r));
      expect(mail.linkRequested).not.toHaveBeenCalled();
    });

    it('refuses a clinic already linked to another owner (PS-04, negative)', async () => {
      linkRepo.findOne.mockResolvedValue({
        id: 3,
        ownerId: 99,
        clinicId: 10,
        status: OwnerClinicLinkStatus.APPROVED,
      });
      await expect(service.requestLink(5, 10, admin)).rejects.toThrow(
        ConflictException,
      );
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a clinic pending for another owner (negative)', async () => {
      linkRepo.findOne.mockResolvedValue({
        id: 3,
        ownerId: 99,
        clinicId: 10,
        status: OwnerClinicLinkStatus.PENDING,
      });
      await expect(service.requestLink(5, 10, admin)).rejects.toThrow(
        ConflictException,
      );
    });

    it('reuses a rejected/expired row so the clinic keeps one row (edge)', async () => {
      linkRepo.findOne.mockResolvedValue({
        id: 3,
        ownerId: 99,
        clinicId: 10,
        status: OwnerClinicLinkStatus.EXPIRED,
        createdBy: 1,
      });
      await service.requestLink(5, 10, admin);
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 3,
          ownerId: 5,
          status: OwnerClinicLinkStatus.PENDING,
        }),
      );
    });

    it('is idempotent for an already approved link of the same owner (edge)', async () => {
      linkRepo.findOne.mockResolvedValue({
        id: 3,
        ownerId: 5,
        clinicId: 10,
        status: OwnerClinicLinkStatus.APPROVED,
      });
      const res = await service.requestLink(5, 10, admin);
      expect(res.status).toBe(OwnerClinicLinkStatus.APPROVED);
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a target that is not a multi-klinik owner, or a missing clinic (negative)', async () => {
      userRepo.findOne.mockResolvedValueOnce({ id: 5, role: UserRole.OWNER });
      await expect(service.requestLink(5, 10, admin)).rejects.toThrow(
        BadRequestException,
      );
      clinicRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.requestLink(5, 10, admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('respond (owner klinik)', () => {
    const pending = () => ({
      id: 3,
      ownerId: 5,
      clinicId: 10,
      status: OwnerClinicLinkStatus.PENDING,
      requestedAt: new Date(Date.now() - 2 * DAY),
      clinic,
      owner: mco,
    });
    const clinicOwner = { userId: 20, name: 'Pemilik', role: UserRole.OWNER };

    it('approves and tells the multi-klinik owner (positive)', async () => {
      linkRepo.findOne.mockResolvedValue(pending());
      const res = await service.respond(3, 10, true, clinicOwner);
      expect(res.status).toBe(OwnerClinicLinkStatus.APPROVED);
      expect(linkRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3, clinicId: 10 } }),
      );
      expect(mail.linkAnswered).toHaveBeenCalledWith(
        ['o@x.id'],
        'Klinik A',
        true,
      );
      expect(auditLog.record).toHaveBeenCalled();
    });

    it('rejects (positive)', async () => {
      linkRepo.findOne.mockResolvedValue(pending());
      const res = await service.respond(3, 10, false, clinicOwner);
      expect(res.status).toBe(OwnerClinicLinkStatus.REJECTED);
    });

    it('never lets the multi-klinik owner approve from inside the branch (security)', async () => {
      await expect(
        service.respond(3, 10, true, {
          userId: 5,
          role: UserRole.OWNER,
          branchMode: true,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it('cannot answer another clinic’s request (negative)', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      await expect(service.respond(3, 11, true, clinicOwner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses an answered or overdue request (edge)', async () => {
      linkRepo.findOne.mockResolvedValue({
        ...pending(),
        status: OwnerClinicLinkStatus.APPROVED,
      });
      await expect(service.respond(3, 10, true, clinicOwner)).rejects.toThrow(
        ConflictException,
      );

      linkRepo.findOne.mockResolvedValue({
        ...pending(),
        requestedAt: new Date(Date.now() - 91 * DAY),
      });
      await expect(service.respond(3, 10, true, clinicOwner)).rejects.toThrow(
        ConflictException,
      );
      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OwnerClinicLinkStatus.EXPIRED }),
      );
    });
  });

  describe('expireStaleRequests (PS-02)', () => {
    it('expires pending requests older than 90 days (positive)', async () => {
      const now = new Date('2026-10-15T00:00:00Z');
      const count = await service.expireStaleRequests(now);
      expect(count).toBe(2);
      const [where, set] = linkRepo.update.mock.calls[0];
      expect(where.status).toBe(OwnerClinicLinkStatus.PENDING);
      expect(where.requestedAt.value).toEqual(
        new Date(now.getTime() - 90 * DAY),
      );
      expect(set).toEqual({ status: OwnerClinicLinkStatus.EXPIRED });
    });
  });

  describe('access', () => {
    it('only approved links give access to a branch (security)', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      await expect(service.assertOwnsClinic(5, 10)).rejects.toThrow(
        ForbiddenException,
      );
      expect(linkRepo.findOne).toHaveBeenCalledWith({
        where: {
          ownerId: 5,
          clinicId: 10,
          status: OwnerClinicLinkStatus.APPROVED,
        },
      });
    });

    it('bills only branches in "owner" mode (positive)', async () => {
      linkRepo.find.mockResolvedValue([
        { clinicId: 10, billingMode: BranchBillingMode.OWNER },
        { clinicId: 11, billingMode: BranchBillingMode.SELF },
        { clinicId: 12, billingMode: BranchBillingMode.STOPPED },
      ]);
      await expect(service.getOwnerBilledClinicIds(5)).resolves.toEqual([10]);
    });

    it('changes a branch billing mode and audits it (positive)', async () => {
      linkRepo.findOne.mockResolvedValue({
        id: 3,
        ownerId: 5,
        clinicId: 10,
        status: OwnerClinicLinkStatus.APPROVED,
        billingMode: BranchBillingMode.OWNER,
        clinic,
      });
      const res = await service.setBillingMode(5, 10, BranchBillingMode.SELF, {
        userId: 5,
      });
      expect(res.billingMode).toBe(BranchBillingMode.SELF);
      expect(auditLog.record).toHaveBeenCalled();
    });

    it('cannot change the billing mode of a branch it does not own (negative)', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      await expect(
        service.setBillingMode(5, 99, BranchBillingMode.SELF, { userId: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDashboard', () => {
    beforeEach(() => {
      linkRepo.find.mockImplementation(({ where }) =>
        Promise.resolve(
          where.status === OwnerClinicLinkStatus.APPROVED
            ? [
                { clinicId: 10, clinic: { name: 'A' }, billingMode: 'owner' },
                { clinicId: 11, clinic: { name: 'B' }, billingMode: 'self' },
              ]
            : [],
        ),
      );
      dashboardService.getSummary.mockImplementation((id: number) =>
        Promise.resolve({
          totalPatients: id === 10 ? 3 : 4,
          activePractitioners: 1,
          todayVisits: 2,
          monthlyRevenue: 100,
          totalTransactions: 5,
        }),
      );
    });

    it('sums every branch and reports the shared account pool (positive)', async () => {
      const res = await service.getDashboard(5);
      expect(res.totals.totalPatients).toBe(7);
      expect(res.totals.monthlyRevenue).toBe(200);
      expect(res.branches).toHaveLength(2);
      expect(res.quota).toEqual({
        accountsUsed: 7,
        accountsLimit: 50,
        activeBranches: 2,
        storageGbLimit: 10,
        storageUsedBytes: 0,
        storageLimitBytes: 0,
      });
    });

    it('filters to one branch (positive)', async () => {
      const res = await service.getDashboard(5, 11);
      expect(res.clinics.map((c) => c.clinic.id)).toEqual([11]);
      expect(res.totals.totalPatients).toBe(4);
      expect(res.branches).toHaveLength(2);
    });

    it('refuses a filter on a branch it does not own (security)', async () => {
      await expect(service.getDashboard(5, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns empty totals without branches (edge)', async () => {
      linkRepo.find.mockResolvedValue([]);
      dataSource.manager.query.mockResolvedValue([{ branches: 0, used: 0 }]);
      const res = await service.getDashboard(5);
      expect(res.clinics).toEqual([]);
      expect(res.totals.totalPatients).toBe(0);
      expect(res.quota.accountsLimit).toBe(0);
    });
  });

  describe('getReport', () => {
    beforeEach(() => {
      linkRepo.find.mockResolvedValue([
        { clinicId: 10, clinic: { name: 'A' } },
        { clinicId: 11, clinic: { name: 'B' } },
      ]);
      linkRepo.findOne.mockResolvedValue({ id: 1 });
    });

    it('combines visits and revenue per branch and per day (positive)', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { clinicId: 10, visits: '4', finished: '3', cancelled: '1' },
        ])
        .mockResolvedValueOnce([
          {
            clinicId: 10,
            billings: '3',
            revenue: '300000.00',
            collected: '250000',
            outstanding: '50000',
          },
          {
            clinicId: 11,
            billings: '1',
            revenue: '100000',
            collected: '100000',
            outstanding: '0',
          },
        ])
        .mockResolvedValueOnce([{ date: '2026-10-02', visits: '3' }])
        .mockResolvedValueOnce([
          { date: '2026-10-01', revenue: '100000' },
          { date: '2026-10-02', revenue: '300000' },
        ]);

      const res = await service.getReport(5, {
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      });

      expect(dataSource.query.mock.calls[0][1]).toEqual([
        [10, 11],
        '2026-10-01',
        '2026-10-31',
      ]);
      expect(res.totals).toEqual({
        visits: 4,
        finished: 3,
        cancelled: 1,
        revenue: 400000,
        collected: 350000,
        outstanding: 50000,
        billings: 4,
      });
      expect(res.clinics[1]).toMatchObject({
        clinic: { id: 11, name: 'B' },
        visits: 0,
        revenue: 100000,
      });
      expect(res.byDay).toEqual([
        { date: '2026-10-01', visits: 0, revenue: 100000 },
        { date: '2026-10-02', visits: 3, revenue: 300000 },
      ]);
    });

    it('scopes to one owned branch (positive)', async () => {
      await service.getReport(5, {
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        clinicId: 11,
      });
      expect(dataSource.query.mock.calls[0][1][0]).toEqual([11]);
    });

    it('refuses a branch it does not own (security)', async () => {
      linkRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getReport(5, {
          dateFrom: '2026-10-01',
          dateTo: '2026-10-31',
          clinicId: 99,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('returns zeros without querying when there are no branches (edge)', async () => {
      linkRepo.find.mockResolvedValue([]);
      const res = await service.getReport(5, {
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      });
      expect(res.totals.visits).toBe(0);
      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('unlinkClinic', () => {
    it('removes the link and audits it (positive)', async () => {
      linkRepo.findOne.mockResolvedValue({
        id: 3,
        ownerId: 5,
        clinicId: 10,
        clinic,
      });
      await service.unlinkClinic(5, 10, admin);
      expect(linkRepo.delete).toHaveBeenCalledWith({ id: 3 });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'DELETE', clinicId: 10 }),
      );
    });

    it('404s when not linked (negative)', async () => {
      await expect(service.unlinkClinic(5, 10, admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listOwners', () => {
    it('lists approved branches and every link with its status (positive)', async () => {
      userRepo.find.mockResolvedValue([
        { id: 5, name: 'Bu Owner', email: 'o@x.id', isActive: true },
      ]);
      linkRepo.find.mockResolvedValue([
        {
          id: 1,
          ownerId: 5,
          clinicId: 10,
          status: 'approved',
          clinic: { id: 10, name: 'A' },
        },
        {
          id: 2,
          ownerId: 5,
          clinicId: 11,
          status: 'pending',
          requestedAt: new Date(),
          clinic: { id: 11, name: 'B' },
        },
      ]);
      const [owner] = await service.listOwners();
      expect(owner.clinics).toEqual([{ id: 10, name: 'A' }]);
      expect(owner.links.map((l) => l.status)).toEqual(['approved', 'pending']);
      expect(owner.links[1].expiresAt).toBeInstanceOf(Date);
    });
  });
});

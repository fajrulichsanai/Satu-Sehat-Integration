import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  AuditLogService,
  RecordAuditLogInput,
} from '../audit-log.service';
import { AuditActionType, AuditLog, AuditStatus } from '../entities/audit-log.entity';

function buildQueryBuilderMock(overrides: Partial<Record<string, any>> = {}) {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
  return qb;
}

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let qb: ReturnType<typeof buildQueryBuilderMock>;

  const baseInput: RecordAuditLogInput = {
    clinicId: 1,
    actorId: 10,
    actorName: 'Dr. A',
    actorRole: 'owner',
    actionType: AuditActionType.CREATE,
    entityType: 'patient',
    entityId: 5,
  };

  beforeEach(async () => {
    qb = buildQueryBuilderMock();
    repo = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => qb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('record', () => {
    it('persists a fully-populated audit entry (positive)', async () => {
      await service.record(baseInput);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId: 1,
          actorId: 10,
          entityId: '5',
          status: AuditStatus.SUCCESS,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('defaults optional fields to null when omitted (positive)', async () => {
      await service.record(baseInput);

      const created = repo.create.mock.calls[0][0];
      expect(created.entityLabel).toBeNull();
      expect(created.beforeValue).toBeNull();
      expect(created.failureReason).toBeNull();
    });

    it('swallows repository errors instead of throwing (negative)', async () => {
      repo.save.mockRejectedValue(new Error('DB down'));

      await expect(service.record(baseInput)).resolves.toBeUndefined();
    });

    it('stringifies numeric entityId and keeps null entityId as null (edge)', async () => {
      await service.record({ ...baseInput, entityId: null });
      expect(repo.create.mock.calls[0][0].entityId).toBeNull();
    });
  });

  describe('findAll', () => {
    it('scopes query to caller clinicId when tenant-scoped (positive)', async () => {
      await service.findAll(1, { page: 1, limit: 10 } as any);
      expect(qb.andWhere).toHaveBeenCalledWith('a.clinicId = :clinicId', {
        clinicId: 1,
      });
    });

    it('lets super admin (clinicId null) narrow by query.clinicId (positive)', async () => {
      await service.findAll(null, {
        page: 1,
        limit: 10,
        clinicId: 7,
      } as any);
      expect(qb.andWhere).toHaveBeenCalledWith('a.clinicId = :queryClinicId', {
        queryClinicId: 7,
      });
    });

    it('ignores query.clinicId for tenant-scoped caller (negative — no cross-tenant leak)', async () => {
      await service.findAll(1, { page: 1, limit: 10, clinicId: 999 } as any);
      const calledWithQueryClinic = qb.andWhere.mock.calls.some(
        (c: any[]) => c[0] === 'a.clinicId = :queryClinicId',
      );
      expect(calledWithQueryClinic).toBe(false);
    });

    it('applies search filter when provided (positive)', async () => {
      await service.findAll(1, {
        page: 1,
        limit: 10,
        search: 'john',
      } as any);
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(a.actorName LIKE :search OR a.entityLabel LIKE :search)',
        { search: '%john%' },
      );
    });
  });

  describe('findOne', () => {
    it('returns the entry when found within scope (positive)', async () => {
      const entry = { id: 1, clinicId: 1 };
      qb.getOne.mockResolvedValue(entry);

      const result = await service.findOne(1, 1);

      expect(result).toBe(entry);
    });

    it('throws NotFoundException when entry does not exist (negative)', async () => {
      qb.getOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('scopes lookup by clinicId for non-super-admin (positive)', async () => {
      qb.getOne.mockResolvedValue({ id: 1 });
      await service.findOne(1, 5);
      expect(qb.andWhere).toHaveBeenCalledWith('a.clinicId = :clinicId', {
        clinicId: 5,
      });
    });

    it('does not scope by clinicId for super admin (positive)', async () => {
      qb.getOne.mockResolvedValue({ id: 1 });
      await service.findOne(1, null);
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('exportCsv', () => {
    it('produces a CSV with header and escaped rows (positive)', async () => {
      qb.getMany.mockResolvedValue([
        {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          actorName: 'Say "Hi"',
          actorRole: 'owner',
          actionType: AuditActionType.CREATE,
          entityType: 'patient',
          entityLabel: 'Budi',
          entityId: null,
          status: AuditStatus.SUCCESS,
          ipAddress: '127.0.0.1',
        },
      ]);

      const csv = await service.exportCsv(1, { page: 1, limit: 10 } as any);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Timestamp');
      expect(lines[1]).toContain('Say ""Hi""');
      expect(qb.take).toHaveBeenCalledWith(10000);
    });

    it('returns header-only CSV when there are no rows (negative/edge)', async () => {
      qb.getMany.mockResolvedValue([]);
      const csv = await service.exportCsv(1, { page: 1, limit: 10 } as any);
      expect(csv.split('\n')).toHaveLength(1);
    });

    it('falls back to entityId when entityLabel is missing (edge)', async () => {
      qb.getMany.mockResolvedValue([
        {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          actorName: 'A',
          actorRole: 'admin',
          actionType: AuditActionType.UPDATE,
          entityType: 'patient',
          entityLabel: null,
          entityId: '42',
          status: AuditStatus.SUCCESS,
          ipAddress: null,
        },
      ]);
      const csv = await service.exportCsv(1, { page: 1, limit: 10 } as any);
      expect(csv).toContain('42');
    });
  });
});

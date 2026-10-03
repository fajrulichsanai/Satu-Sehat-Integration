import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SoapTemplatesService } from '../soap-templates.service';
import { SoapTemplate } from '../entities/soap-template.entity';
import { UserRole } from '../../../enums/user-role.enum';

function buildQb(result: any[] = []) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  };
}

describe('SoapTemplatesService', () => {
  let service: SoapTemplatesService;
  let repo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  const owner = { userId: 1, role: UserRole.OWNER };
  const dokter = { userId: 2, role: UserRole.DOKTER };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SoapTemplatesService,
        { provide: getRepositoryToken(SoapTemplate), useValue: repo },
      ],
    }).compile();

    service = module.get<SoapTemplatesService>(SoapTemplatesService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('filters to shared-only templates when type=shared (positive)', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(1, { type: 'shared' } as any, dokter);
      expect(qb.andWhere).toHaveBeenCalledWith('t.isShared = true');
    });

    it('filters to own personal templates when type=personal (positive)', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(1, { type: 'personal' } as any, dokter);
      expect(qb.andWhere).toHaveBeenCalledWith(
        't.isShared = false AND t.createdBy = :userId',
        { userId: dokter.userId },
      );
    });

    it('shows shared + own templates by default (positive/edge)', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(1, {} as any, dokter);
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(t.isShared = true OR t.createdBy = :userId)',
        { userId: dokter.userId },
      );
    });
  });

  describe('create', () => {
    it('lets an OWNER create a shared template (positive)', async () => {
      const result = await service.create(
        1,
        { name: 'T', isShared: true } as any,
        owner,
      );
      expect(result.isShared).toBe(true);
    });

    it('defaults isShared to false when omitted (edge)', async () => {
      const result = await service.create(1, { name: 'T' } as any, dokter);
      expect(result.isShared).toBe(false);
    });

    it('throws ForbiddenException when a non-OWNER tries to create a shared template (negative)', async () => {
      await expect(
        service.create(1, { name: 'T', isShared: true } as any, dokter),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('lets the creator update their own personal template (positive)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        createdBy: dokter.userId,
        name: 'Old',
      });
      const result = await service.update(1, 1, { name: 'New' } as any, dokter);
      expect(result.name).toBe('New');
    });

    it('lets an OWNER update any template regardless of creator (positive)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        createdBy: dokter.userId,
        name: 'Old',
      });
      const result = await service.update(1, 1, { name: 'New' } as any, owner);
      expect(result.name).toBe('New');
    });

    it('throws ForbiddenException when a non-owner tries to edit someone else’s template (negative)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        createdBy: 999,
      });
      await expect(
        service.update(1, 1, { name: 'New' } as any, dokter),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a non-owner tries to flip isShared to true (negative)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        createdBy: dokter.userId,
      });
      await expect(
        service.update(1, 1, { isShared: true } as any, dokter),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the template does not exist (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, 1, {} as any, owner),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('lets the creator remove their own template (positive)', async () => {
      const template = { id: 1, clinicId: 1, createdBy: dokter.userId };
      repo.findOne.mockResolvedValue(template);
      await service.remove(1, 1, dokter);
      expect(repo.remove).toHaveBeenCalledWith(template);
    });

    it('throws ForbiddenException when a non-owner tries to remove someone else’s template (negative)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, createdBy: 999 });
      await expect(service.remove(1, 1, dokter)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the template does not exist (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, 1, owner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

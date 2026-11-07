import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users.service';
import { User } from '../entities/user.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { UserRole } from '../../../enums';
import { UsersMailService } from '../users-mail.service';

const mockUserRepo = () => ({
  manager: { query: jest.fn().mockResolvedValue([]) },
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn(),
  remove: jest.fn(),
});

const mockPractitionerRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn(),
  delete: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let practitionerRepo: ReturnType<typeof mockPractitionerRepo>;
  let mail: { sendWelcome: jest.Mock };

  const owner = { userId: 1, role: UserRole.OWNER, clinicId: 1 };
  const superAdmin = { userId: 99, role: UserRole.SUPER_ADMIN, clinicId: null };

  beforeEach(async () => {
    mail = { sendWelcome: jest.fn().mockResolvedValue(true) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersMailService, useValue: mail },
        { provide: getRepositoryToken(User), useValue: mockUserRepo() },
        {
          provide: getRepositoryToken(Practitioner),
          useValue: mockPractitionerRepo(),
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
    practitionerRepo = module.get(getRepositoryToken(Practitioner));
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findOne', () => {
    it('returns sanitized user when found in same clinic (positive)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        role: UserRole.ADMIN,
        email: 'a@x.com',
        passwordHash: 'secret',
      });

      const result = await service.findOne(2, owner);

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundException if user not found (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for cross-clinic access (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await service.findOne(999, owner).catch(() => undefined);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 999, clinicId: 1 },
      });
    });

    it('super admin can look up user in any clinic (positive)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 5,
        clinicId: 42,
        role: UserRole.ADMIN,
      });
      const result = await service.findOne(5, superAdmin);
      expect(result.success).toBe(true);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });

  describe('activate', () => {
    it('activates a pending user (positive)', async () => {
      const user = {
        id: 2,
        clinicId: 1,
        isActive: false,
        role: UserRole.PENDING,
      };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, isActive: true });

      const result = await service.activate(2, owner);

      expect(userRepo.save).toHaveBeenCalled();
      expect(result.data.isActive).toBe(true);
    });

    it('throws NotFoundException if user not found (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.activate(999, owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException if user already active (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        isActive: true,
        role: UserRole.ADMIN,
      });
      await expect(service.activate(2, owner)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException if user is not pending (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        isActive: false,
        role: UserRole.ADMIN,
      });
      await expect(service.activate(2, owner)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when target is in another clinic (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.activate(2, owner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivate', () => {
    it('deactivates an active non-owner user (positive)', async () => {
      const user = {
        id: 2,
        clinicId: 1,
        isActive: true,
        role: UserRole.ADMIN,
      };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, isActive: false });

      const result = await service.deactivate(2, owner);

      expect(result.data.isActive).toBe(false);
    });

    it('throws ForbiddenException when deactivating an OWNER (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        isActive: true,
        role: UserRole.OWNER,
      });
      await expect(service.deactivate(2, owner)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException if already inactive (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        isActive: false,
        role: UserRole.ADMIN,
      });
      await expect(service.deactivate(2, owner)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('removes a user and cascades practitioner delete for DOKTER (positive)', async () => {
      const user = {
        id: 2,
        clinicId: 1,
        role: UserRole.DOKTER,
      };
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.remove(2, owner);

      expect(practitionerRepo.delete).toHaveBeenCalledWith({ userId: 2 });
      expect(userRepo.remove).toHaveBeenCalledWith(user);
      expect(result.success).toBe(true);
    });

    it('does not touch practitioner repo for non-doctor roles (positive)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        role: UserRole.ADMIN,
      });

      await service.remove(2, owner);

      expect(practitionerRepo.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when deleting self (negative)', async () => {
      await expect(service.remove(owner.userId, owner)).rejects.toThrow(
        ForbiddenException,
      );
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when target does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(2, owner)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRoles', () => {
    it('returns limited roles for non-super-admin (positive)', async () => {
      const result = await service.getRoles(owner);
      const values = result.data.map((r) => r.value);
      expect(values).toEqual([
        UserRole.ADMIN,
        UserRole.DOKTER,
        UserRole.PERAWAT,
      ]);
    });

    it('returns full role list for super admin (positive)', async () => {
      const result = await service.getRoles(superAdmin);
      const values = result.data.map((r) => r.value);
      expect(values).toContain(UserRole.SUPER_ADMIN);
      expect(values).toContain(UserRole.OWNER);
    });
  });

  describe('Manajer Cabang (MC-01)', () => {
    // The shared account pool query (AS branches) has room; the branch link exists.
    const pool = (sql: string) => (sql.includes('AS branches') ? [{ branches: 1, used: 2 }] : null);
    const linked = () =>
      userRepo.manager.query.mockImplementation((sql: string) =>
        Promise.resolve(pool(sql) ?? (sql.includes('owner_clinic_links') ? [{ id: 1, ownerId: 5 }] : [])),
      );

    it('offers the role to the owner of a linked branch only (positive/edge)', async () => {
      let values = (await service.getRoles(owner)).data.map((r) => r.value);
      expect(values).not.toContain(UserRole.MANAJER_CABANG);
      linked();
      values = (await service.getRoles(owner)).data.map((r) => r.value);
      expect(values[0]).toBe(UserRole.MANAJER_CABANG);
      const asManager = { ...owner, actorRole: UserRole.MANAJER_CABANG };
      values = (await service.getRoles(asManager)).data.map((r) => r.value);
      expect(values).not.toContain(UserRole.MANAJER_CABANG);
    });

    it('lets the branch owner appoint a manager (positive)', async () => {
      linked();
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockResolvedValue({});
      const res = await service.invite(
        { email: 'm@x.id', name: 'Manajer', role: UserRole.MANAJER_CABANG } as any,
        owner,
      );
      expect(res.data.role).toBe(UserRole.MANAJER_CABANG);
    });

    it('refuses a manager for a clinic that is not a branch (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.invite({ email: 'm@x.id', name: 'M', role: UserRole.MANAJER_CABANG } as any, owner),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows only one active manager per branch (negative)', async () => {
      userRepo.manager.query.mockImplementation((sql: string) =>
        Promise.resolve(
          pool(sql) ??
            (sql.includes('owner_clinic_links') || sql.includes("role = 'manajer_cabang'") ? [{ id: 1, ownerId: 5 }] : []),
        ),
      );
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.invite({ email: 'm2@x.id', name: 'M2', role: UserRole.MANAJER_CABANG } as any, owner),
      ).rejects.toThrow(ConflictException);
    });

    it('a manager cannot appoint or manage another manager, nor the owner (security)', async () => {
      linked();
      const asManager = { ...owner, userId: 7, actorRole: UserRole.MANAJER_CABANG };
      await expect(
        service.invite({ email: 'm@x.id', name: 'M', role: UserRole.MANAJER_CABANG } as any, asManager),
      ).rejects.toThrow(ForbiddenException);
      userRepo.findOne.mockResolvedValue({ id: 8, clinicId: 1, role: UserRole.MANAJER_CABANG, isActive: true });
      await expect(service.deactivate(8, asManager)).rejects.toThrow(ForbiddenException);
      userRepo.findOne.mockResolvedValue({ id: 2, clinicId: 1, role: UserRole.OWNER, isActive: true });
      await expect(service.deactivate(2, asManager)).rejects.toThrow(ForbiddenException);
    });

    it('the clinic owner can manage the manager (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 8, clinicId: 1, role: UserRole.MANAJER_CABANG, isActive: true });
      userRepo.save.mockResolvedValue({});
      const res = await service.deactivate(8, owner);
      expect(res.data.isActive).toBe(false);
    });
  });

  describe('akun baru & data sensitif', () => {
    it('invite sets a temporary password that must be changed and emails it (positive)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockResolvedValue({});
      const res = await service.invite({ email: 'n@x.id', name: 'Baru', role: UserRole.ADMIN } as any, owner);
      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: true }));
      expect(mail.sendWelcome).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'n@x.id', temporaryPassword: res.data.temporaryPassword }),
      );
      expect(res.data.emailSent).toBe(true);
      expect(res.data).not.toHaveProperty('passwordHash');
    });

    it('never returns credentials of listed users (security)', async () => {
      userRepo.find.mockResolvedValue([
        {
          id: 3,
          email: 'a@x.id',
          passwordHash: 'h',
          mfaSecret: 's',
          mfaBackupCodes: ['c'],
          verificationToken: 'v',
          resetPasswordToken: 'r',
          resetPasswordExpiresAt: new Date(),
          tokenVersion: 4,
          mfaEnabled: true,
        },
      ]);
      const res = await service.findAll(owner);
      expect(Object.keys(res.data[0]).sort()).toEqual(['email', 'id', 'mfaEnabled']);
    });
  });

  describe('assignRole', () => {
    it('assigns a valid role to a subordinate user (positive)', async () => {
      const user = {
        id: 2,
        clinicId: 1,
        role: UserRole.PENDING,
      };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, role: UserRole.ADMIN });

      const result = await service.assignRole(2, UserRole.ADMIN, owner);

      expect(result.data.role).toBe(UserRole.ADMIN);
    });

    it('creates a practitioner row when assigning DOKTER role (positive)', async () => {
      const user = {
        id: 2,
        clinicId: 1,
        role: UserRole.PENDING,
        name: 'Dr A',
        email: 'a@x.com',
      };
      userRepo.findOne.mockResolvedValue(user);
      practitionerRepo.findOne.mockResolvedValue(null);

      await service.assignRole(2, UserRole.DOKTER, owner);

      expect(practitionerRepo.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when assigning PENDING role (negative)', async () => {
      await expect(
        service.assignRole(2, UserRole.PENDING, owner),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when owner tries to assign OWNER role (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        role: UserRole.ADMIN,
      });
      await expect(
        service.assignRole(2, UserRole.OWNER, owner),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when trying to change an existing OWNER role (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        role: UserRole.OWNER,
      });
      await expect(
        service.assignRole(2, UserRole.ADMIN, superAdmin),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRole', () => {
    it('updates a pending user role and activates them (positive)', async () => {
      const user = { id: 2, clinicId: 1, role: UserRole.PENDING };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({
        ...user,
        role: UserRole.ADMIN,
        isActive: true,
      });

      const result = await service.updateRole(2, UserRole.ADMIN, owner);

      expect(result.data.isActive).toBe(true);
      expect(result.data.role).toBe(UserRole.ADMIN);
    });

    it('throws ConflictException if user is not pending (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        role: UserRole.ADMIN,
      });
      await expect(
        service.updateRole(2, UserRole.DOKTER, owner),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for a disallowed target role (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        clinicId: 1,
        role: UserRole.PENDING,
      });
      await expect(
        service.updateRole(2, UserRole.SUPER_ADMIN, superAdmin),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('invite', () => {
    const dto = {
      email: 'new@x.com',
      name: 'New User',
      role: UserRole.ADMIN,
    } as any;

    it('creates a new user for an owner within their own clinic (positive)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockResolvedValue({ id: 10, ...dto, clinicId: 1 });

      const result = await service.invite(dto, owner);

      // Password sementara acak, bukan nilai tetap
      expect(result.data.temporaryPassword).toMatch(
        /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{10}$/,
      );
      expect(result.data.temporaryPassword).not.toBe('123asd');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: 1 }),
      );
    });

    it('throws ConflictException when email already used (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 5, email: dto.email });
      await expect(service.invite(dto, owner)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException when super admin omits clinicId (negative)', async () => {
      await expect(
        service.invite({ ...dto, clinicId: undefined }, superAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when owner tries to invite an OWNER (negative)', async () => {
      await expect(
        service.invite({ ...dto, role: UserRole.OWNER }, owner),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows super admin to invite SUPER_ADMIN without clinicId (positive)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.save.mockResolvedValue({ id: 11 });

      await service.invite({ ...dto, role: UserRole.SUPER_ADMIN }, superAdmin);

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: null }),
      );
    });
  });

  describe('update', () => {
    it('updates name and email (positive)', async () => {
      const user = { id: 2, clinicId: 1, email: 'old@x.com', name: 'Old' };
      userRepo.findOne
        .mockResolvedValueOnce(user) // findByIdOrThrow
        .mockResolvedValueOnce(null); // email uniqueness check
      userRepo.save.mockResolvedValue({
        ...user,
        email: 'new@x.com',
        name: 'New',
      });

      const result = await service.update(
        2,
        { email: 'new@x.com', name: 'New' } as any,
        owner,
      );

      expect(result.data.email).toBe('new@x.com');
    });

    it('throws ConflictException when new email already in use (negative)', async () => {
      const user = { id: 2, clinicId: 1, email: 'old@x.com', name: 'Old' };
      userRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ id: 3, email: 'taken@x.com' });

      await expect(
        service.update(2, { email: 'taken@x.com' } as any, owner),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when target user does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, { name: 'X' } as any, owner),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll / findPending', () => {
    it('scopes findAll to own clinic for non-super-admin (positive)', async () => {
      userRepo.find.mockResolvedValue([]);
      await service.findAll(owner);
      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 1 } }),
      );
    });

    it('does not scope findAll for super admin (positive)', async () => {
      userRepo.find.mockResolvedValue([]);
      await service.findAll(superAdmin);
      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters findPending by email when provided (positive)', async () => {
      userRepo.find.mockResolvedValue([]);
      await service.findPending(owner, 'x@x.com');
      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: UserRole.PENDING, clinicId: 1, email: 'x@x.com' },
        }),
      );
    });
  });
});

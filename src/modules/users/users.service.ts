import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';
import { UserRole, ROLE_LEVEL } from '../../enums';
import { InviteUserDto, UpdateUserDto } from './dto/user.dto';

interface CurrentUserPayload {
  userId: number;
  role: UserRole;
  clinicId: number | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Practitioner)
    private practitionerRepository: Repository<Practitioner>,
  ) {}

  /**
   * Memastikan user dengan role dokter memiliki baris practitioners terkait,
   * supaya langsung muncul di dropdown dokter (kunjungan) tanpa input manual.
   */
  private async ensurePractitionerForUser(user: User) {
    if (!user.clinicId) return;

    const existing = await this.practitionerRepository.findOne({
      where: { userId: user.id },
    });
    if (existing) return;

    const practitioner = this.practitionerRepository.create({
      userId: user.id,
      clinicId: user.clinicId,
      name: user.name,
      email: user.email,
      isActive: true,
      createdBy: user.id,
      updatedBy: user.id,
    });

    await this.practitionerRepository.save(practitioner);
    this.logger.log(`[AUTO-PRACTITIONER] Practitioner dibuat otomatis | userId=${user.id}, clinicId=${user.clinicId}`);
  }

  private isSuperAdmin(currentUser: CurrentUserPayload): boolean {
    return currentUser.role === UserRole.SUPER_ADMIN;
  }

  /**
   * Throws if currentUser may not manage targetUser:
   * - non-SuperAdmin acting outside their own clinic
   * - acting on someone at or above their own role level (peer/owner/super-admin)
   */
  private assertCanManage(currentUser: CurrentUserPayload, targetUser: User) {
    if (this.isSuperAdmin(currentUser)) {
      return;
    }

    if (targetUser.clinicId !== currentUser.clinicId) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CROSS_CLINIC_FORBIDDEN',
          message: 'Tidak bisa mengelola user dari klinik lain',
        },
      });
    }

    if (ROLE_LEVEL[targetUser.role] <= ROLE_LEVEL[currentUser.role]) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Tidak bisa mengelola user dengan role setara atau lebih tinggi',
        },
      });
    }
  }

  /** Throws if currentUser may not assign newRole to anyone. */
  private assertCanAssignRole(currentUser: CurrentUserPayload, newRole: UserRole) {
    if (this.isSuperAdmin(currentUser)) {
      return;
    }

    if (ROLE_LEVEL[newRole] <= ROLE_LEVEL[currentUser.role]) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Tidak bisa memberikan role setara atau lebih tinggi dari role sendiri',
        },
      });
    }
  }

  private async findByIdOrThrow(id: number, currentUser: CurrentUserPayload): Promise<User> {
    const where = this.isSuperAdmin(currentUser)
      ? { id }
      : { id, clinicId: currentUser.clinicId as number };

    const user = await this.userRepository.findOne({ where });

    if (!user) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    return user;
  }

  async findAll(currentUser: CurrentUserPayload) {
    this.logger.log(
      `[GET-ALL] Mengambil semua user | clinicId=${currentUser.clinicId}, requestedByRole=${currentUser.role}`,
    );

    const users = await this.userRepository.find({
      where: this.isSuperAdmin(currentUser) ? {} : { clinicId: currentUser.clinicId as number },
      order: { createdAt: 'DESC' },
    });

    this.logger.log(`[GET-ALL] Berhasil mengambil ${users.length} user`);

    return {
      success: true,
      data: users.map((user) => this.sanitizeUser(user)),
    };
  }

  async findOne(id: number, currentUser: CurrentUserPayload) {
    this.logger.log(`[GET-ONE] Mengambil data user | userId=${id}`);

    const user = await this.findByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, user);

    this.logger.log(`[GET-ONE] Berhasil mengambil data user | userId=${id}, email=${user.email}`);

    return {
      success: true,
      data: this.sanitizeUser(user),
    };
  }

  async activate(id: number, currentUser: CurrentUserPayload) {
    this.logger.log(`[ACTIVATE] Memulai aktivasi user | userId=${id}, requestedBy=${currentUser.userId}`);

    const user = await this.findByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, user);

    if (user.isActive) {
      throw new ConflictException({
        success: false,
        error: { code: 'USER_ALREADY_ACTIVE', message: 'User sudah aktif' },
      });
    }

    if (user.role !== UserRole.PENDING) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'INVALID_USER_STATUS',
          message: 'Hanya user dengan status pending yang bisa diaktivasi',
        },
      });
    }

    user.isActive = true;
    user.updatedBy = currentUser.userId;

    await this.userRepository.save(user);

    this.logger.log(`[ACTIVATE] User berhasil diaktivasi | userId=${id}, email=${user.email}`);

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        message: 'User berhasil diaktivasi',
      },
    };
  }

  async deactivate(id: number, currentUser: CurrentUserPayload) {
    this.logger.log(`[DEACTIVATE] Memulai deaktivasi user | userId=${id}, requestedBy=${currentUser.userId}`);

    const user = await this.findByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, user);

    if (user.role === UserRole.OWNER || user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CANNOT_DEACTIVATE_OWNER',
          message: 'Owner/Super Admin tidak bisa dinonaktifkan',
        },
      });
    }

    if (!user.isActive) {
      throw new ConflictException({
        success: false,
        error: { code: 'USER_ALREADY_INACTIVE', message: 'User sudah tidak aktif' },
      });
    }

    user.isActive = false;
    user.updatedBy = currentUser.userId;

    await this.userRepository.save(user);

    this.logger.log(`[DEACTIVATE] User berhasil dinonaktifkan | userId=${id}, email=${user.email}`);

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        message: 'User berhasil dinonaktifkan',
      },
    };
  }

  async remove(id: number, currentUser: CurrentUserPayload) {
    this.logger.log(`[DELETE] Memulai penghapusan user | userId=${id}, requestedBy=${currentUser.userId}`);

    if (id === currentUser.userId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_DELETE_SELF', message: 'Tidak bisa menghapus akun sendiri' },
      });
    }

    const user = await this.findByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, user);

    await this.userRepository.remove(user);

    this.logger.log(`[DELETE] User berhasil dihapus | userId=${id}, email=${user.email}`);

    return {
      success: true,
      data: { message: 'User berhasil dihapus' },
    };
  }

  getRoles(currentUser: CurrentUserPayload) {
    this.logger.log('[GET-ROLES] Mengambil daftar role yang tersedia');

    const roles = this.isSuperAdmin(currentUser)
      ? [
          { value: UserRole.SUPER_ADMIN, label: 'Super Admin' },
          { value: UserRole.OWNER, label: 'Owner' },
          { value: UserRole.ADMIN, label: 'Admin' },
          { value: UserRole.DOKTER, label: 'Dokter' },
        ]
      : [
          { value: UserRole.ADMIN, label: 'Admin' },
          { value: UserRole.DOKTER, label: 'Dokter' },
        ];

    return { success: true, data: roles };
  }

  async findPending(currentUser: CurrentUserPayload, email?: string) {
    this.logger.log(
      `[GET-PENDING] Mengambil daftar user pending | clinicId=${currentUser.clinicId}${email ? `, filterEmail=${email}` : ''}`,
    );

    const where: any = { role: UserRole.PENDING };

    if (!this.isSuperAdmin(currentUser)) {
      where.clinicId = currentUser.clinicId;
    }

    if (email) {
      where.email = email;
    }

    const users = await this.userRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    this.logger.log(`[GET-PENDING] Berhasil mengambil ${users.length} user pending`);

    return {
      success: true,
      data: users.map((user) => this.sanitizeUser(user)),
    };
  }

  async assignRole(id: number, newRole: UserRole, currentUser: CurrentUserPayload) {
    this.logger.log(`[ASSIGN-ROLE] Memulai assign role | userId=${id}, newRole=${newRole}, requestedBy=${currentUser.userId}`);

    if (newRole === UserRole.PENDING) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role tidak bisa di-assign ke pending' },
      });
    }

    const user = await this.findByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, user);
    this.assertCanAssignRole(currentUser, newRole);

    if ((user.role === UserRole.OWNER || user.role === UserRole.SUPER_ADMIN) && newRole !== user.role) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'CANNOT_CHANGE_OWNER_ROLE', message: 'Role owner/super admin tidak bisa diubah' },
      });
    }

    const previousRole = user.role;
    user.role = newRole;
    user.updatedBy = currentUser.userId;

    await this.userRepository.save(user);

    if (newRole === UserRole.DOKTER) {
      await this.ensurePractitionerForUser(user);
    }

    this.logger.log(`[ASSIGN-ROLE] Role berhasil di-assign | userId=${id}, ${previousRole} -> ${newRole}`);

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        message: 'Role user berhasil di-assign',
      },
    };
  }

  async updateRole(id: number, newRole: UserRole, currentUser: CurrentUserPayload) {
    this.logger.log(`[UPDATE-ROLE] Memulai update role user pending | userId=${id}, newRole=${newRole}`);

    const user = await this.findByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, user);
    this.assertCanAssignRole(currentUser, newRole);

    if (user.role !== UserRole.PENDING) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'INVALID_USER_STATUS',
          message: 'Hanya user dengan status pending yang bisa diupdate rolenya',
        },
      });
    }

    if (![UserRole.ADMIN, UserRole.DOKTER, UserRole.OWNER].includes(newRole)) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Role hanya bisa diubah ke admin, dokter, atau owner' },
      });
    }

    user.role = newRole;
    user.isActive = true;
    user.updatedBy = currentUser.userId;

    await this.userRepository.save(user);

    if (newRole === UserRole.DOKTER) {
      await this.ensurePractitionerForUser(user);
    }

    this.logger.log(`[UPDATE-ROLE] Role user pending berhasil diupdate | userId=${id}, newRole=${newRole}`);

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        message: 'Role user berhasil diupdate',
      },
    };
  }

  async invite(dto: InviteUserDto, currentUser: CurrentUserPayload) {
    this.logger.log(`[INVITE] Membuat user baru | email=${dto.email}, role=${dto.role}, requestedBy=${currentUser.userId}`);

    this.assertCanAssignRole(currentUser, dto.role);

    let clinicId: number | null;
    if (this.isSuperAdmin(currentUser)) {
      if (dto.role !== UserRole.SUPER_ADMIN && !dto.clinicId) {
        throw new BadRequestException({
          success: false,
          error: { code: 'CLINIC_ID_REQUIRED', message: 'clinicId wajib diisi untuk role selain super admin' },
        });
      }
      clinicId = dto.role === UserRole.SUPER_ADMIN ? null : (dto.clinicId as number);
    } else {
      clinicId = currentUser.clinicId;
    }

    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException({
        success: false,
        error: { code: 'EMAIL_ALREADY_USED', message: 'Email sudah digunakan' },
      });
    }

    const temporaryPassword = crypto.randomBytes(9).toString('base64').replace(/[/+=]/g, '');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = this.userRepository.create({
      email: dto.email,
      name: dto.name,
      role: dto.role,
      clinicId,
      passwordHash,
      isActive: true,
      emailVerifiedAt: new Date(),
      createdBy: currentUser.userId,
      updatedBy: currentUser.userId,
    });

    await this.userRepository.save(user);

    if (dto.role === UserRole.DOKTER) {
      await this.ensurePractitionerForUser(user);
    }

    this.logger.log(`[INVITE] User baru berhasil dibuat | userId=${user.id}, email=${user.email}`);

    return {
      success: true,
      data: {
        ...this.sanitizeUser(user),
        temporaryPassword,
        message: 'User berhasil dibuat. Bagikan password sementara ini kepada user.',
      },
    };
  }

  async update(id: number, dto: UpdateUserDto, currentUser: CurrentUserPayload) {
    this.logger.log(`[UPDATE] Memulai update data user | userId=${id}, requestedBy=${currentUser.userId}`);

    const user = await this.findByIdOrThrow(id, currentUser);
    this.assertCanManage(currentUser, user);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException({
          success: false,
          error: { code: 'EMAIL_ALREADY_USED', message: 'Email sudah digunakan' },
        });
      }
      user.email = dto.email;
    }

    if (dto.name) {
      user.name = dto.name;
    }

    user.updatedBy = currentUser.userId;

    await this.userRepository.save(user);

    this.logger.log(`[UPDATE] User berhasil diupdate | userId=${id}`);

    return {
      success: true,
      data: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: User) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}

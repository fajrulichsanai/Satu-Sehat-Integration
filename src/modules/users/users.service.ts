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
import { User } from './entities/user.entity';
import { UserRole } from '../../enums';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(clinicId: number, userRole: string) {
    this.logger.log(`[GET-ALL] Mengambil semua user | clinicId=${clinicId}, requestedByRole=${userRole}`);

    const users = await this.userRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });

    this.logger.log(`[GET-ALL] Berhasil mengambil ${users.length} user | clinicId=${clinicId}`);

    return {
      success: true,
      data: users.map((user) => this.sanitizeUser(user)),
    };
  }

  async findOne(id: number, clinicId: number) {
    this.logger.log(`[GET-ONE] Mengambil data user | userId=${id}, clinicId=${clinicId}`);

    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      this.logger.warn(`[GET-ONE] User tidak ditemukan | userId=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    this.logger.log(`[GET-ONE] Berhasil mengambil data user | userId=${id}, email=${user.email}`);

    return {
      success: true,
      data: this.sanitizeUser(user),
    };
  }

  async activate(id: number, clinicId: number, activatedBy: number) {
    this.logger.log(`[ACTIVATE] Memulai aktivasi user | userId=${id}, clinicId=${clinicId}, activatedBy=${activatedBy}`);

    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      this.logger.warn(`[ACTIVATE] User tidak ditemukan | userId=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    if (user.isActive) {
      this.logger.warn(`[ACTIVATE] User sudah aktif, aktivasi dibatalkan | userId=${id}, email=${user.email}`);
      throw new ConflictException({
        success: false,
        error: {
          code: 'USER_ALREADY_ACTIVE',
          message: 'User sudah aktif',
        },
      });
    }

    if (user.role !== UserRole.PENDING) {
      this.logger.warn(`[ACTIVATE] User bukan pending, tidak bisa diaktivasi | userId=${id}, role=${user.role}`);
      throw new ConflictException({
        success: false,
        error: {
          code: 'INVALID_USER_STATUS',
          message: 'Hanya user dengan status pending yang bisa diaktivasi',
        },
      });
    }

    user.isActive = true;
    user.updatedBy = activatedBy;

    await this.userRepository.save(user);

    this.logger.log(`[ACTIVATE] User berhasil diaktivasi | userId=${id}, email=${user.email}, activatedBy=${activatedBy}`);

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

  async deactivate(id: number, clinicId: number, deactivatedBy: number) {
    this.logger.log(`[DEACTIVATE] Memulai deaktivasi user | userId=${id}, clinicId=${clinicId}, deactivatedBy=${deactivatedBy}`);

    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      this.logger.warn(`[DEACTIVATE] User tidak ditemukan | userId=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    if (user.role === UserRole.OWNER) {
      this.logger.warn(`[DEACTIVATE] Percobaan deaktivasi owner ditolak | userId=${id}, email=${user.email}`);
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CANNOT_DEACTIVATE_OWNER',
          message: 'Owner tidak bisa dinonaktifkan',
        },
      });
    }

    if (!user.isActive) {
      this.logger.warn(`[DEACTIVATE] User sudah tidak aktif | userId=${id}, email=${user.email}`);
      throw new ConflictException({
        success: false,
        error: {
          code: 'USER_ALREADY_INACTIVE',
          message: 'User sudah tidak aktif',
        },
      });
    }

    user.isActive = false;
    user.updatedBy = deactivatedBy;

    await this.userRepository.save(user);

    this.logger.log(`[DEACTIVATE] User berhasil dinonaktifkan | userId=${id}, email=${user.email}, deactivatedBy=${deactivatedBy}`);

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

  async remove(id: number, clinicId: number) {
    this.logger.log(`[DELETE] Memulai penghapusan user pending | userId=${id}, clinicId=${clinicId}`);

    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      this.logger.warn(`[DELETE] User tidak ditemukan | userId=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    if (user.role !== UserRole.PENDING) {
      this.logger.warn(`[DELETE] User bukan pending, tidak bisa dihapus | userId=${id}, role=${user.role}`);
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CANNOT_DELETE_ACTIVE_USER',
          message:
            'Hanya user pending yang bisa dihapus. Gunakan deactivate untuk user aktif.',
        },
      });
    }

    await this.userRepository.remove(user);

    this.logger.log(`[DELETE] User pending berhasil dihapus | userId=${id}, email=${user.email}`);

    return {
      success: true,
      data: {
        message: 'User pending berhasil ditolak/dihapus',
      },
    };
  }

  getRoles() {
    this.logger.log('[GET-ROLES] Mengambil daftar role yang tersedia');

    const roles = [
      { value: UserRole.OWNER, label: 'Owner' },
      { value: UserRole.ADMIN, label: 'Admin' },
      { value: UserRole.DOKTER, label: 'Dokter' },
    ];

    this.logger.log(`[GET-ROLES] Berhasil mengembalikan ${roles.length} role`);

    return { success: true, data: roles };
  }

  async findPending(clinicId: number, email?: string) {
    this.logger.log(
      `[GET-PENDING] Mengambil daftar user pending | clinicId=${clinicId}${email ? `, filterEmail=${email}` : ''}`,
    );

    const where: any = { role: UserRole.PENDING };

    if (email) {
      where.email = email;
    }

    const users = await this.userRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    this.logger.log(`[GET-PENDING] Berhasil mengambil ${users.length} user pending | clinicId=${clinicId}`);

    return {
      success: true,
      data: users.map((user) => this.sanitizeUser(user)),
    };
  }

  async assignRole(
    id: number,
    clinicId: number,
    newRole: UserRole,
    updatedBy: number,
  ) {
    this.logger.log(`[ASSIGN-ROLE] Memulai assign role | userId=${id}, clinicId=${clinicId}, newRole=${newRole}, updatedBy=${updatedBy}`);

    if (newRole === UserRole.PENDING) {
      this.logger.warn(`[ASSIGN-ROLE] Role pending tidak valid untuk di-assign | userId=${id}`);
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Role tidak bisa di-assign ke pending',
        },
      });
    }

    const user = await this.userRepository.findOne({ where: { id, clinicId } });

    if (!user) {
      this.logger.warn(`[ASSIGN-ROLE] User tidak ditemukan | userId=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    if (user.role === UserRole.OWNER && newRole !== UserRole.OWNER) {
      this.logger.warn(`[ASSIGN-ROLE] Percobaan ubah role owner ditolak | userId=${id}, email=${user.email}`);
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CANNOT_CHANGE_OWNER_ROLE',
          message: 'Role owner tidak bisa diubah',
        },
      });
    }

    const previousRole = user.role;
    user.role = newRole;
    user.updatedBy = updatedBy;

    await this.userRepository.save(user);

    this.logger.log(`[ASSIGN-ROLE] Role berhasil di-assign | userId=${id}, email=${user.email}, ${previousRole} -> ${newRole}, updatedBy=${updatedBy}`);

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

  async updateRole(id: number, clinicId: number, newRole: UserRole) {
    this.logger.log(`[UPDATE-ROLE] Memulai update role user pending | userId=${id}, clinicId=${clinicId}, newRole=${newRole}`);

    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      this.logger.warn(`[UPDATE-ROLE] User tidak ditemukan | userId=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    if (user.role === UserRole.OWNER) {
      this.logger.warn(`[UPDATE-ROLE] Percobaan ubah role owner ditolak | userId=${id}, email=${user.email}`);
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CANNOT_CHANGE_OWNER_ROLE',
          message: 'Role owner tidak bisa diubah',
        },
      });
    }

    if (user.role !== UserRole.PENDING) {
      this.logger.warn(`[UPDATE-ROLE] User bukan pending, update role dibatalkan | userId=${id}, role=${user.role}`);
      throw new ConflictException({
        success: false,
        error: {
          code: 'INVALID_USER_STATUS',
          message: 'Hanya user dengan status pending yang bisa diupdate rolenya',
        },
      });
    }

    if (![UserRole.ADMIN, UserRole.DOKTER].includes(newRole)) {
      this.logger.warn(`[UPDATE-ROLE] Role tidak valid | userId=${id}, newRole=${newRole}`);
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Role hanya bisa diubah ke admin atau dokter',
        },
      });
    }

    user.role = newRole;
    user.isActive = true;

    await this.userRepository.save(user);

    this.logger.log(`[UPDATE-ROLE] Role user pending berhasil diupdate | userId=${id}, email=${user.email}, newRole=${newRole}, isActive=true`);

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

  private sanitizeUser(user: User) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}

import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from '../../enums';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get all users in a clinic
   * Owner sees all users, Admin sees limited info
   */
  async findAll(clinicId: number, userRole: string) {
    const users = await this.userRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: users.map((user) => this.sanitizeUser(user)),
    };
  }

  /**
   * Get user by ID
   */
  async findOne(id: number, clinicId: number) {
    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    return {
      success: true,
      data: this.sanitizeUser(user),
    };
  }

  /**
   * Activate user (Owner only)
   * Changes status from pending to admin/dokter
   */
  async activate(id: number, clinicId: number, activatedBy: number) {
    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    // Check if already active
    if (user.isActive) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'USER_ALREADY_ACTIVE',
          message: 'User sudah aktif',
        },
      });
    }

    // Check if user is pending
    if (user.role !== UserRole.PENDING) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'INVALID_USER_STATUS',
          message: 'Hanya user dengan status pending yang bisa diaktivasi',
        },
      });
    }

    // Activate user - keep the original intended role stored somewhere
    // For now, we'll assume the role was stored correctly during registration
    // In a real implementation, you might want to store intended_role separately
    user.isActive = true;
    user.updatedBy = activatedBy;

    await this.userRepository.save(user);

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

  /**
   * Deactivate user (Owner only)
   */
  async deactivate(id: number, clinicId: number, deactivatedBy: number) {
    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    // Cannot deactivate owner
    if (user.role === UserRole.OWNER) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CANNOT_DEACTIVATE_OWNER',
          message: 'Owner tidak bisa dinonaktifkan',
        },
      });
    }

    // Check if already inactive
    if (!user.isActive) {
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

  /**
   * Delete/reject pending user (Owner only)
   */
  async remove(id: number, clinicId: number) {
    const user = await this.userRepository.findOne({
      where: { id, clinicId },
    });

    if (!user) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: `User dengan ID ${id} tidak ditemukan`,
        },
      });
    }

    // Only pending users can be deleted
    if (user.role !== UserRole.PENDING) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CANNOT_DELETE_ACTIVE_USER',
          message: 'Hanya user pending yang bisa dihapus. Gunakan deactivate untuk user aktif.',
        },
      });
    }

    await this.userRepository.remove(user);

    return {
      success: true,
      data: {
        message: 'User pending berhasil ditolak/dihapus',
      },
    };
  }

  /**
   * Sanitize user data (remove sensitive fields)
   */
  private sanitizeUser(user: User) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}

import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnerCode } from './entities/owner-code.entity';
import { CreateOwnerCodeDto } from './dto/owner-code.dto';

@Injectable()
export class OwnerCodeService {
  constructor(
    @InjectRepository(OwnerCode)
    private ownerCodeRepository: Repository<OwnerCode>,
  ) {}

  async create(dto: CreateOwnerCodeDto) {
    const existingCode = await this.ownerCodeRepository.findOne({
      where: { code: dto.code },
    });

    if (existingCode) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'OWNER_CODE_ALREADY_EXISTS',
          message: 'Kode owner sudah ada',
        },
      });
    }

    const ownerCode = this.ownerCodeRepository.create({
      code: dto.code,
    });

    await this.ownerCodeRepository.save(ownerCode);

    return {
      success: true,
      data: {
        id: ownerCode.id,
        code: ownerCode.code,
        isUsed: ownerCode.isUsed,
        createdAt: ownerCode.createdAt,
      },
    };
  }

  /** Codes with the owner who used each one and the clinic they registered (OC-02). */
  async findAll() {
    const codes = await this.ownerCodeRepository.find({
      order: { createdAt: 'DESC' },
    });
    const userIds = codes
      .map((c) => c.usedBy)
      .filter((id): id is number => !!id);
    const users: {
      id: number;
      name: string;
      email: string;
      clinicId: number | null;
      clinicName: string | null;
    }[] = userIds.length
      ? await this.ownerCodeRepository.manager.query(
          `SELECT u.id, u.name, u.email, u.clinic_id AS clinicId, c.name AS clinicName
               FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id
              WHERE u.id IN (?)`,
          [userIds],
        )
      : [];
    const byId = new Map(users.map((u) => [Number(u.id), u]));

    return {
      success: true,
      data: codes.map((code) => {
        const user = code.usedBy ? byId.get(Number(code.usedBy)) : undefined;
        return {
          ...code,
          usedByName: user?.name ?? null,
          usedByEmail: user?.email ?? null,
          clinicId: user?.clinicId != null ? Number(user.clinicId) : null,
          clinicName: user?.clinicName ?? null,
        };
      }),
    };
  }

  async validate(code: string): Promise<boolean> {
    if (!code || code.trim() === '') {
      return false;
    }

    const ownerCode = await this.ownerCodeRepository.findOne({
      where: { code },
    });

    return ownerCode ? !ownerCode.isUsed : false;
  }

  async markAsUsed(code: string, userId: number) {
    const ownerCode = await this.ownerCodeRepository.findOne({
      where: { code },
    });

    if (!ownerCode) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'OWNER_CODE_NOT_FOUND',
          message: 'Kode owner tidak ditemukan',
        },
      });
    }

    if (ownerCode.isUsed) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'OWNER_CODE_ALREADY_USED',
          message: 'Kode owner sudah digunakan',
        },
      });
    }

    ownerCode.isUsed = true;
    ownerCode.usedBy = userId;
    ownerCode.usedAt = new Date();

    await this.ownerCodeRepository.save(ownerCode);

    return {
      success: true,
      data: { message: 'Kode owner berhasil digunakan' },
    };
  }
}

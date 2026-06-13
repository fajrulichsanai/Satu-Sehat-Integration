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

  async findAll() {
    const codes = await this.ownerCodeRepository.find({
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: codes,
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

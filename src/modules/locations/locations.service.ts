import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../location/entities/location.entity';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
  ) {}

  /**
   * Get all locations in clinic
   */
  async findAll(clinicId: number, activeOnly?: boolean) {
    const where: any = { clinicId };

    if (activeOnly) {
      where.isActive = true;
    }

    const locations = await this.locationRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: locations,
    };
  }

  /**
   * Get location by ID
   */
  async findOne(id: number, clinicId: number) {
    const location = await this.locationRepository.findOne({
      where: { id, clinicId },
    });

    if (!location) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location tidak ditemukan',
        },
      });
    }

    return {
      success: true,
      data: location,
    };
  }

  /**
   * Create new location
   */
  async create(dto: CreateLocationDto, clinicId: number, createdBy: number) {
    // Check if location name already exists in this clinic
    const existing = await this.locationRepository.findOne({
      where: { name: dto.name, clinicId },
    });

    if (existing) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'DUPLICATE_LOCATION_NAME',
          message: 'Nama lokasi sudah ada di klinik ini',
        },
      });
    }

    const location = this.locationRepository.create({
      ...dto,
      clinicId,
      createdBy,
      updatedBy: createdBy,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    await this.locationRepository.save(location);

    return {
      success: true,
      data: location,
      message: 'Location berhasil dibuat',
    };
  }

  /**
   * Update location
   */
  async update(
    id: number,
    dto: UpdateLocationDto,
    clinicId: number,
    updatedBy: number,
  ) {
    const location = await this.locationRepository.findOne({
      where: { id, clinicId },
    });

    if (!location) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location tidak ditemukan',
        },
      });
    }

    // Check if new name conflicts with existing location
    if (dto.name && dto.name !== location.name) {
      const existing = await this.locationRepository.findOne({
        where: { name: dto.name, clinicId },
      });

      if (existing) {
        throw new ConflictException({
          success: false,
          error: {
            code: 'DUPLICATE_LOCATION_NAME',
            message: 'Nama lokasi sudah ada di klinik ini',
          },
        });
      }
    }

    Object.assign(location, dto);
    location.updatedBy = updatedBy;

    await this.locationRepository.save(location);

    return {
      success: true,
      data: location,
      message: 'Location berhasil diperbarui',
    };
  }

  /**
   * Delete location
   */
  async remove(id: number, clinicId: number) {
    const location = await this.locationRepository.findOne({
      where: { id, clinicId },
    });

    if (!location) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location tidak ditemukan',
        },
      });
    }

    // TODO: Add validation - check if location has associated encounters
    // For now, allow deletion

    await this.locationRepository.remove(location);

    return {
      success: true,
      data: {
        message: 'Location berhasil dihapus',
      },
    };
  }

  /**
   * Activate/deactivate location
   */
  async toggleActive(id: number, clinicId: number, updatedBy: number) {
    const location = await this.locationRepository.findOne({
      where: { id, clinicId },
    });

    if (!location) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location tidak ditemukan',
        },
      });
    }

    location.isActive = !location.isActive;
    location.updatedBy = updatedBy;

    await this.locationRepository.save(location);

    return {
      success: true,
      data: location,
      message: `Location berhasil ${location.isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
    };
  }
}

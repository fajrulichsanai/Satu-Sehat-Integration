import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { CreatePrescriptionItemDto } from './dto/prescription-item.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(PrescriptionItem)
    private readonly itemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async listByEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<PrescriptionItem[]> {
    await this.assertEncounterExists(encounterId, clinicId);
    return this.itemRepository.find({
      where: { encounterId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(
    encounterId: number,
    clinicId: number,
    dto: CreatePrescriptionItemDto,
    userId: number,
  ): Promise<PrescriptionItem> {
    await this.assertEncounterExists(encounterId, clinicId);
    const count = await this.itemRepository.count({ where: { encounterId } });
    const item = this.itemRepository.create({
      encounterId,
      ...dto,
      sortOrder: count,
      createdBy: userId,
    });
    return this.itemRepository.save(item);
  }

  async remove(
    encounterId: number,
    clinicId: number,
    itemId: number,
  ): Promise<void> {
    await this.assertEncounterExists(encounterId, clinicId);
    const result = await this.itemRepository.delete({
      id: itemId,
      encounterId,
    });
    if (!result.affected) {
      throw new NotFoundException(`Resep dengan ID ${itemId} tidak ditemukan`);
    }
  }

  private async assertEncounterExists(
    encounterId: number,
    clinicId: number,
  ): Promise<void> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Kunjungan dengan ID ${encounterId} tidak ditemukan`,
      );
    }
  }
}

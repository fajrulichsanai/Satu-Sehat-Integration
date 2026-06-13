import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdontogramData } from '../odontogram-data/entities/odontogram-data.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { UpsertOdontogramDto } from './dto/odontogram.dto';

const STATUS_DECAYED = new Set(['karies', 'caries']);
const STATUS_MISSING = new Set(['cabut', 'missing', 'extracted', 'M']);
const STATUS_FILLED = new Set([
  'tumpatan',
  'filled',
  'komposit',
  'amalgam',
  'F',
  'RCT',
]);

@Injectable()
export class OdontogramService {
  constructor(
    @InjectRepository(OdontogramData)
    private readonly odontogramRepo: Repository<OdontogramData>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
  ) {}

  async findByEncounter(encounterId: number, clinicId: number) {
    await this.verifyEncounter(encounterId, clinicId);
    const data = await this.odontogramRepo.findOne({ where: { encounterId } });
    if (!data) return null;
    return {
      teeth: data.teethData,
      dmft: {
        decayed: data.dmftDecayed,
        missing: data.dmftMissing,
        filled: data.dmftFilled,
        total: data.dmftTotal,
      },
      additionalFindings: data.additionalFindings,
    };
  }

  async upsert(
    encounterId: number,
    clinicId: number,
    dto: UpsertOdontogramDto,
    userId: number,
  ) {
    await this.verifyEncounter(encounterId, clinicId);

    const dmft = this.calculateDmft(dto.teeth);

    let record = await this.odontogramRepo.findOne({ where: { encounterId } });
    if (record) {
      record.teethData = dto.teeth;
      record.dmftDecayed = dmft.decayed;
      record.dmftMissing = dmft.missing;
      record.dmftFilled = dmft.filled;
      record.dmftTotal = dmft.total;
      record.additionalFindings = dto.additionalFindings as any;
      record.updatedBy = userId;
    } else {
      record = this.odontogramRepo.create({
        encounterId,
        teethData: dto.teeth,
        dmftDecayed: dmft.decayed,
        dmftMissing: dmft.missing,
        dmftFilled: dmft.filled,
        dmftTotal: dmft.total,
        additionalFindings: dto.additionalFindings as any,
        createdBy: userId,
      });
    }
    await this.odontogramRepo.save(record);
    return { dmft, savedAt: new Date() };
  }

  private calculateDmft(teeth: Record<string, any>) {
    let decayed = 0,
      missing = 0,
      filled = 0;

    for (const toothData of Object.values(teeth)) {
      if (!toothData) continue;

      // Check surfaces for caries/filling status
      const surfaces = toothData.surfaces || {};
      let toothDecayed = false,
        toothFilled = false;

      for (const surface of Object.values(surfaces)) {
        if (typeof surface === 'string') {
          if (STATUS_DECAYED.has(surface.toLowerCase())) toothDecayed = true;
          if (STATUS_FILLED.has(surface.toLowerCase())) toothFilled = true;
        }
      }

      // Check status indicators
      const statusAbove = toothData.statusAbove || '';
      const statusBelow = toothData.statusBelow || '';
      const isRCT = toothData.isRCT === true;

      if (STATUS_MISSING.has(statusAbove) || STATUS_MISSING.has(statusBelow)) {
        missing++;
      } else if (toothDecayed) {
        decayed++;
      } else if (toothFilled || isRCT) {
        filled++;
      }
    }

    return { decayed, missing, filled, total: decayed + missing + filled };
  }

  private async verifyEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<void> {
    const enc = await this.encounterRepo.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!enc)
      throw new NotFoundException(
        `Encounter dengan ID ${encounterId} tidak ditemukan`,
      );
  }
}

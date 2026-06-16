import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VitalSign } from '../vital-sign/entities/vital-sign.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { UpsertVitalSignsDto } from './dto/vital-signs.dto';

interface VitalSignDef {
  field: keyof UpsertVitalSignsDto;
  loincCode: string;
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
}

const VITAL_SIGN_DEFS: VitalSignDef[] = [
  {
    field: 'sistolic',
    loincCode: '8480-6',
    name: 'Tekanan Darah Sistolik',
    unit: 'mmHg',
    normalMin: 90,
    normalMax: 120,
  },
  {
    field: 'diastolic',
    loincCode: '8462-4',
    name: 'Tekanan Darah Diastolik',
    unit: 'mmHg',
    normalMin: 60,
    normalMax: 80,
  },
  {
    field: 'heartRate',
    loincCode: '8867-4',
    name: 'Denyut Jantung',
    unit: '/menit',
    normalMin: 60,
    normalMax: 100,
  },
  {
    field: 'respiratoryRate',
    loincCode: '9279-1',
    name: 'Frekuensi Napas',
    unit: '/menit',
    normalMin: 12,
    normalMax: 20,
  },
  {
    field: 'temperature',
    loincCode: '8310-5',
    name: 'Suhu Tubuh',
    unit: '°C',
    normalMin: 36.1,
    normalMax: 37.2,
  },
  {
    field: 'weight',
    loincCode: '29463-7',
    name: 'Berat Badan',
    unit: 'kg',
    normalMin: 0.5,
    normalMax: 500,
  },
  {
    field: 'height',
    loincCode: '8302-2',
    name: 'Tinggi Badan',
    unit: 'cm',
    normalMin: 30,
    normalMax: 250,
  },
  {
    field: 'spo2',
    loincCode: '59408-5',
    name: 'SpO2',
    unit: '%',
    normalMin: 95,
    normalMax: 100,
  },
];

@Injectable()
export class VitalSignsService {
  private readonly logger = new Logger(VitalSignsService.name);

  constructor(
    @InjectRepository(VitalSign)
    private readonly vitalSignRepository: Repository<VitalSign>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async findByEncounter(encounterId: number, clinicId: number) {
    await this.verifyEncounter(encounterId, clinicId);
    return this.vitalSignRepository.find({ where: { encounterId } });
  }

  async upsert(
    encounterId: number,
    clinicId: number,
    dto: UpsertVitalSignsDto,
    userId: number,
  ) {
    await this.verifyEncounter(encounterId, clinicId);

    const warnings: { field: string; message: string }[] = [];
    const toSave: Partial<VitalSign>[] = [];

    for (const def of VITAL_SIGN_DEFS) {
      const value = dto[def.field];
      if (value === undefined || value === null) continue;

      const isOutOfRange = value < def.normalMin || value > def.normalMax;
      if (isOutOfRange) {
        warnings.push({
          field: def.field,
          message: `Nilai di luar rentang normal (${def.normalMin}-${def.normalMax} ${def.unit})`,
        });
      }

      // Delete existing record for this loinc code in this encounter
      await this.vitalSignRepository.delete({
        encounterId,
        loincCode: def.loincCode,
      });

      toSave.push({
        encounterId,
        loincCode: def.loincCode,
        name: def.name,
        value,
        unit: def.unit,
        isOutOfRange,
        recordedAt: new Date(),
        createdBy: userId,
      });
    }

    if (toSave.length > 0) {
      await this.vitalSignRepository.save(toSave);
    }

    return { savedAt: new Date(), warnings };
  }

  private async verifyEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<void> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Encounter dengan ID ${encounterId} tidak ditemukan`,
      );
    }
  }
}

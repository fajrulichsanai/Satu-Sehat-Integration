import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Anamnesis } from './entities/anamnesis.entity';
import { Allergy } from '../allergy/entities/allergy.entity';
import { MedicationHistory } from '../medical-history/entities/medication-history.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { UpsertAnamnesisDto } from './dto/anamnesis.dto';

@Injectable()
export class AnamnesisService {
  constructor(
    @InjectRepository(Anamnesis)
    private readonly anamnesisRepository: Repository<Anamnesis>,
    @InjectRepository(Allergy)
    private readonly allergyRepository: Repository<Allergy>,
    @InjectRepository(MedicationHistory)
    private readonly medHistoryRepository: Repository<MedicationHistory>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async findByEncounter(encounterId: number, clinicId: number) {
    await this.verifyEncounter(encounterId, clinicId);

    const anamnesis = await this.anamnesisRepository.findOne({
      where: { encounterId },
    });
    const alergi = await this.allergyRepository.find({
      where: { encounterId },
    });
    const riwayatObat = await this.medHistoryRepository.find({
      where: { encounterId },
    });

    return { anamnesis, alergi, riwayatObat };
  }

  async upsert(
    encounterId: number,
    clinicId: number,
    dto: UpsertAnamnesisDto,
    userId: number,
  ) {
    await this.verifyEncounter(encounterId, clinicId);

    let anamnesis = await this.anamnesisRepository.findOne({
      where: { encounterId },
    });

    if (anamnesis) {
      Object.assign(anamnesis, {
        keluhanUtama: dto.keluhanUtama,
        riwayatPenyakit: dto.riwayatPenyakit ?? anamnesis.riwayatPenyakit,
        golonganDarah: dto.golonganDarah ?? anamnesis.golonganDarah,
        rhesus: dto.rhesus ?? anamnesis.rhesus,
        statusKehamilan: dto.statusKehamilan ?? anamnesis.statusKehamilan,
        updatedBy: userId,
      });
    } else {
      anamnesis = this.anamnesisRepository.create({
        encounterId,
        keluhanUtama: dto.keluhanUtama,
        riwayatPenyakit: dto.riwayatPenyakit,
        golonganDarah: dto.golonganDarah,
        rhesus: dto.rhesus,
        statusKehamilan: dto.statusKehamilan,
        createdBy: userId,
      });
    }
    await this.anamnesisRepository.save(anamnesis);

    if (dto.alergi !== undefined) {
      await this.allergyRepository.delete({ encounterId });
      if (dto.alergi.length > 0) {
        await this.allergyRepository.save(
          dto.alergi.map((a) =>
            this.allergyRepository.create({
              encounterId,
              ...a,
              createdBy: userId,
            }),
          ),
        );
      }
    }

    if (dto.riwayatObat !== undefined) {
      await this.medHistoryRepository.delete({ encounterId });
      if (dto.riwayatObat.length > 0) {
        await this.medHistoryRepository.save(
          dto.riwayatObat.map((m) =>
            this.medHistoryRepository.create({
              encounterId,
              ...m,
              createdBy: userId,
            }),
          ),
        );
      }
    }

    return { savedAt: new Date() };
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncounterSoapNote } from './entities/encounter-soap-note.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { UpsertEncounterSoapNoteDto } from './dto/encounter-soap-note.dto';

@Injectable()
export class EncounterSoapNotesService {
  constructor(
    @InjectRepository(EncounterSoapNote)
    private readonly soapNoteRepository: Repository<EncounterSoapNote>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async findByEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<EncounterSoapNote | null> {
    await this.assertEncounterExists(encounterId, clinicId);
    return this.soapNoteRepository.findOne({ where: { encounterId } });
  }

  async upsertForEncounter(
    encounterId: number,
    clinicId: number,
    dto: UpsertEncounterSoapNoteDto,
    userId: number,
  ): Promise<EncounterSoapNote> {
    await this.assertEncounterExists(encounterId, clinicId);

    let note = await this.soapNoteRepository.findOne({
      where: { encounterId },
    });

    if (!note) {
      note = this.soapNoteRepository.create({
        encounterId,
        subjective: dto.subjective,
        objective: dto.objective,
        assessment: dto.assessment,
        plan: dto.plan,
        signature: dto.signature,
        createdBy: userId,
      });
    } else {
      Object.assign(note, {
        subjective: dto.subjective ?? note.subjective,
        objective: dto.objective ?? note.objective,
        assessment: dto.assessment ?? note.assessment,
        plan: dto.plan ?? note.plan,
        signature: dto.signature ?? note.signature,
        updatedBy: userId,
      });
    }

    return this.soapNoteRepository.save(note);
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

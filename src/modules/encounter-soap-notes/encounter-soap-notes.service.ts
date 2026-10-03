import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EncounterSoapNote,
  SoapDiagnosis,
} from './entities/encounter-soap-note.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import {
  SoapDiagnosisDto,
  UpsertEncounterSoapNoteDto,
} from './dto/encounter-soap-note.dto';
import { TerminologyService } from '../terminology/terminology.service';

@Injectable()
export class EncounterSoapNotesService {
  constructor(
    @InjectRepository(EncounterSoapNote)
    private readonly soapNoteRepository: Repository<EncounterSoapNote>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    private readonly terminologyService: TerminologyService,
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
    const diagnoses = dto.diagnoses
      ? await this.normalizeDiagnoses(dto.diagnoses)
      : undefined;

    let note = await this.soapNoteRepository.findOne({
      where: { encounterId },
    });

    if (!note) {
      note = this.soapNoteRepository.create({
        encounterId,
        subjective: dto.subjective,
        objective: dto.objective,
        assessment: dto.assessment,
        diagnoses: diagnoses ?? null,
        treatment: dto.treatment,
        plan: dto.plan,
        controlPlan: dto.controlPlan,
        signature: dto.signature,
        createdBy: userId,
      });
    } else {
      Object.assign(note, {
        subjective: dto.subjective ?? note.subjective,
        objective: dto.objective ?? note.objective,
        assessment: dto.assessment ?? note.assessment,
        diagnoses: diagnoses ?? note.diagnoses,
        treatment: dto.treatment ?? note.treatment,
        plan: dto.plan ?? note.plan,
        controlPlan: dto.controlPlan ?? note.controlPlan,
        signature: dto.signature ?? note.signature,
        updatedBy: userId,
      });
    }

    return this.soapNoteRepository.save(note);
  }

  /**
   * Checks every code exists, stores the code system's own name (never the
   * client's), drops duplicates, and keeps exactly one primary diagnosis
   * (the first one, when none was marked).
   */
  private async normalizeDiagnoses(
    items: SoapDiagnosisDto[],
  ): Promise<SoapDiagnosis[]> {
    const unique = items.filter(
      (d, i) =>
        items.findIndex((o) => o.system === d.system && o.code === d.code) ===
        i,
    );
    if (unique.filter((d) => d.primary).length > 1) {
      throw new BadRequestException('Hanya boleh satu diagnosis utama');
    }
    if (!unique.length) return [];
    const concepts = await this.terminologyService.resolve(unique);
    const hasPrimary = unique.some((d) => d.primary);
    return unique.map((d, i) => ({
      system: d.system,
      code: d.code,
      display: concepts.get(`${d.system}:${d.code}`)!.display,
      nameId: this.terminologyService.nameIdFor(d.system, d.code),
      primary: hasPrimary ? !!d.primary : i === 0,
      note: d.note?.trim() || null,
    }));
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

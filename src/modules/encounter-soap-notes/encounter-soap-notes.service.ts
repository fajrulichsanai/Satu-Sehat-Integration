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
  SoapDiet,
  SoapGoal,
  SoapRisk,
} from './entities/encounter-soap-note.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import {
  SoapDiagnosisDto,
  UpsertEncounterSoapNoteDto,
} from './dto/encounter-soap-note.dto';
import { TerminologyService } from '../terminology/terminology.service';
import { ClinicalCatalogService } from '../terminology/clinical-catalog.service';

@Injectable()
export class EncounterSoapNotesService {
  constructor(
    @InjectRepository(EncounterSoapNote)
    private readonly soapNoteRepository: Repository<EncounterSoapNote>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    private readonly terminologyService: TerminologyService,
    private readonly catalog: ClinicalCatalogService,
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
    const chiefComplaint = await this.normalizeChiefComplaint(
      dto.chiefComplaintCode,
    );
    const plan = await this.normalizeCarePlan(dto);

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
        ...(chiefComplaint ?? {}),
        ...plan,
        educationGiven: dto.educationGiven ?? null,
        dischargeCondition: dto.dischargeCondition ?? null,
        prognosis: dto.prognosis ?? null,
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
        ...(chiefComplaint ?? {}),
        ...plan,
        educationGiven: dto.educationGiven ?? note.educationGiven,
        dischargeCondition: dto.dischargeCondition ?? note.dischargeCondition,
        prognosis: dto.prognosis ?? note.prognosis,
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

  /**
   * Keluhan utama SNOMED: kode divalidasi terhadap data terminologi dan
   * namanya diambil dari sana. `undefined` = tidak diubah, '' = dihapus.
   */
  private async normalizeChiefComplaint(code?: string): Promise<
    | {
        chiefComplaintCode: string | null;
        chiefComplaintDisplay: string | null;
      }
    | undefined
  > {
    if (code === undefined) return undefined;
    const trimmed = code.trim();
    if (!trimmed)
      return { chiefComplaintCode: null, chiefComplaintDisplay: null };
    const concepts = await this.terminologyService.resolve([
      { system: 'snomed', code: trimmed },
    ]);
    return {
      chiefComplaintCode: trimmed,
      chiefComplaintDisplay: concepts.get(`snomed:${trimmed}`)!.display,
    };
  }

  /**
   * Diet, tujuan perawatan & penilaian risiko: kode dicek ke katalog resmi /
   * terminologi dan nama disimpan dari sana. undefined = tidak diubah,
   * null = dihapus.
   */
  private async normalizeCarePlan(dto: UpsertEncounterSoapNoteDto) {
    const out: { diet?: SoapDiet | null; goal?: SoapGoal | null; riskAssessment?: SoapRisk | null } = {};
    if (dto.diet !== undefined) {
      out.diet =
        dto.diet && dto.diet.types.length
          ? {
              intent: dto.diet.intent,
              types: [...new Set(dto.diet.types)].map((code) => this.catalog.getDiet(code)),
              note: dto.diet.note?.trim() || null,
            }
          : null;
    }
    const snomed = async (codes: (string | null | undefined)[]) => {
      const list = codes.filter((c): c is string => !!c?.trim()).map((c) => ({ system: 'snomed' as const, code: c.trim() }));
      return list.length ? this.terminologyService.resolve(list) : new Map();
    };
    if (dto.goal !== undefined) {
      if (dto.goal && dto.goal.text?.trim()) {
        const code = dto.goal.code?.trim() || null;
        const found = await snomed([code]);
        out.goal = {
          code,
          display: code ? found.get(`snomed:${code}`)?.display ?? null : null,
          text: dto.goal.text.trim(),
          dueDate: dto.goal.dueDate?.slice(0, 10) ?? null,
        };
      } else out.goal = null;
    }
    if (dto.riskAssessment !== undefined) {
      if (dto.riskAssessment) {
        const r = dto.riskAssessment;
        const outcome = r.outcomeCode?.trim() || null;
        const found = await snomed([r.code, outcome]);
        out.riskAssessment = {
          code: r.code.trim(),
          display: found.get(`snomed:${r.code.trim()}`)?.display ?? r.code,
          outcomeCode: outcome,
          outcomeDisplay: outcome ? found.get(`snomed:${outcome}`)?.display ?? null : null,
          level: r.level,
          mitigation: r.mitigation?.trim() || null,
          note: r.note?.trim() || null,
        };
      } else out.riskAssessment = null;
    }
    return out;
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

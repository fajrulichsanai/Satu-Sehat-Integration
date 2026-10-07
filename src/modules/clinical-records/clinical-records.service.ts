import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { isClinician } from '../../enums';
import { TerminologyService } from '../terminology/terminology.service';
import { SyncOrchestratorService } from '../satusehat/sync/sync-orchestrator.service';
import { PatientCondition } from './entities/patient-condition.entity';
import { ClinicalObservation } from './entities/clinical-observation.entity';
import {
  ABATED_STATUSES,
  CLINICAL_STATUSES,
  CONDITION_SEVERITIES,
  ENTERED_IN_ERROR,
  OBSERVATION_BY_KEY,
  OBSERVATION_CATALOG,
  VERIFICATION_STATUSES,
} from './clinical-codes';
import type { ClinicalStatus } from './clinical-codes';
import {
  CreateConditionDto,
  CreateObservationDto,
  UpdateConditionDto,
  UpdateObservationDto,
} from './dto/clinical-records.dto';

/** SATUSEHAT menolak waktu sebelum 3 Juni 2014 */
const MIN_FHIR_DATE = '2014-06-03';
/** Toleransi jam perangkat yang sedikit maju */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Tanggal hari ini di WIB (YYYY-MM-DD) */
function todayWib(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
  }).format(now);
}

function validDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

const isRemovedCondition = (c: PatientCondition) =>
  c.verificationStatus === ENTERED_IN_ERROR;

/** Pengguna yang sedang login (dari JWT) */
export interface Actor {
  userId: number;
  role: string;
}

/** Bidang sinkronisasi yang ditampilkan ke UI */
const SYNC_RESET = {
  syncStatus: 'pending' as const,
  syncError: null,
};

@Injectable()
export class ClinicalRecordsService {
  constructor(
    @InjectRepository(PatientCondition)
    private readonly conditionRepo: Repository<PatientCondition>,
    @InjectRepository(ClinicalObservation)
    private readonly observationRepo: Repository<ClinicalObservation>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    private readonly terminology: TerminologyService,
    private readonly syncOrchestrator: SyncOrchestratorService,
  ) {}

  /** Pilihan untuk form: status, keparahan, katalog observasi */
  options() {
    const list = <T extends Record<string, { label: string }>>(o: T) =>
      Object.entries(o).map(([value, v]) => ({ value, label: v.label }));
    return {
      clinicalStatuses: list(CLINICAL_STATUSES),
      verificationStatuses: list(VERIFICATION_STATUSES),
      severities: list(CONDITION_SEVERITIES),
      abatedStatuses: ABATED_STATUSES,
      observations: OBSERVATION_CATALOG.map((d) => ({
        key: d.key,
        label: d.label,
        group: d.group,
        kind: d.kind,
        unit: d.unit ?? null,
        min: d.min ?? null,
        max: d.max ?? null,
        decimals: d.decimals ?? null,
        loinc: d.loinc,
        answers: d.answers?.map((a) => ({ code: a.code, label: a.label })),
        hint: d.hint ?? null,
      })),
    };
  }

  // ── Baca ───────────────────────────────────────────────────────────────

  /** Daftar masalah pasien + observasi kunjungan ini */
  async forEncounter(encounterId: number, clinicId: number, actor: Actor) {
    const encounter = await this.getEncounter(encounterId, clinicId, actor);
    const [conditions, observations] = await Promise.all([
      this.listConditions(encounter.patientId, clinicId),
      this.observationRepo.find({
        where: { clinicId, encounterId, status: Not(ENTERED_IN_ERROR) },
        order: { effectiveAt: 'ASC', id: 'ASC' },
      }),
    ]);
    return {
      encounterSynced: !!encounter.satusehatEncounterId,
      conditions,
      observations,
    };
  }

  /** Ringkasan di halaman pasien: daftar masalah + riwayat observasi */
  async forPatient(patientId: number, clinicId: number) {
    const [conditions, observations] = await Promise.all([
      this.listConditions(patientId, clinicId),
      this.observationRepo.find({
        where: { clinicId, patientId, status: Not(ENTERED_IN_ERROR) },
        order: { effectiveAt: 'DESC', id: 'DESC' },
        take: 200,
      }),
    ]);
    return { conditions, observations };
  }

  private listConditions(patientId: number, clinicId: number) {
    return this.conditionRepo.find({
      where: {
        clinicId,
        patientId,
        verificationStatus: Not(ENTERED_IN_ERROR),
      },
      order: { id: 'DESC' },
    });
  }

  // ── Kondisi (Condition) ────────────────────────────────────────────────

  async createCondition(
    encounterId: number,
    clinicId: number,
    dto: CreateConditionDto,
    actor: Actor,
  ): Promise<PatientCondition> {
    const encounter = await this.getEncounter(encounterId, clinicId, actor);
    const system = dto.system;
    const codeKey =
      system === 'snomed' ? dto.code.trim() : dto.code.trim().toUpperCase();
    const concepts = await this.terminology.resolve([
      { system, code: codeKey },
    ]);
    const concept = concepts.get(`${system}:${codeKey}`)!;

    const clinicalStatus = dto.clinicalStatus ?? 'active';
    const fields = this.conditionFields(
      {
        clinicalStatus,
        verificationStatus: dto.verificationStatus ?? 'confirmed',
        severity: dto.severity ?? null,
        onsetDate: dto.onsetDate ?? null,
        abatementDate: dto.abatementDate ?? null,
        note: dto.note ?? null,
      },
      true,
    );

    const existing = await this.conditionRepo.find({
      where: {
        clinicId,
        patientId: encounter.patientId,
        codeSystem: system,
        code: codeKey,
        verificationStatus: Not(ENTERED_IN_ERROR),
      },
    });
    if (
      !ABATED_STATUSES.includes(clinicalStatus) &&
      existing.some(
        (c) => !ABATED_STATUSES.includes(c.clinicalStatus as ClinicalStatus),
      )
    ) {
      throw new ConflictException(
        `${concept.display} sudah ada di daftar masalah pasien — ubah statusnya saja`,
      );
    }

    return this.conditionRepo.save(
      this.conditionRepo.create({
        clinicId,
        patientId: encounter.patientId,
        encounterId,
        lastEncounterId: encounterId,
        codeSystem: system,
        code: codeKey,
        display: concept.display,
        nameId: this.terminology.nameIdFor(system, codeKey),
        ...fields,
        ...SYNC_RESET,
        createdBy: actor.userId,
      }),
    );
  }

  async updateCondition(
    encounterId: number,
    clinicId: number,
    id: number,
    dto: UpdateConditionDto,
    actor: Actor,
  ): Promise<PatientCondition> {
    const encounter = await this.getEncounter(encounterId, clinicId, actor);
    const condition = await this.findCondition(id, clinicId, encounter);
    const merged = {
      clinicalStatus: dto.clinicalStatus ?? condition.clinicalStatus,
      verificationStatus:
        dto.verificationStatus ?? condition.verificationStatus,
      severity: dto.severity === undefined ? condition.severity : dto.severity,
      onsetDate:
        dto.onsetDate === undefined ? condition.onsetDate : dto.onsetDate,
      abatementDate:
        dto.abatementDate === undefined
          ? condition.abatementDate
          : dto.abatementDate,
      note: dto.note === undefined ? condition.note : dto.note,
    };
    // Kembali aktif → tanggal sembuh lama tidak berlaku lagi
    if (
      dto.clinicalStatus &&
      !ABATED_STATUSES.includes(dto.clinicalStatus) &&
      dto.abatementDate === undefined
    ) {
      merged.abatementDate = null;
    }
    Object.assign(condition, this.conditionFields(merged, false), {
      lastEncounterId: encounterId,
      ...SYNC_RESET,
      updatedBy: actor.userId,
    });
    return this.conditionRepo.save(condition);
  }

  /**
   * Belum pernah terkirim → dihapus. Sudah terkirim → ditandai
   * entered-in-error dan dikirim ulang lewat kunjungan ini.
   */
  async removeCondition(
    encounterId: number,
    clinicId: number,
    id: number,
    actor: Actor,
  ): Promise<{ removed: true; pendingSync: boolean }> {
    const encounter = await this.getEncounter(encounterId, clinicId, actor);
    const condition = await this.findCondition(id, clinicId, encounter);
    if (!condition.satusehatId) {
      await this.conditionRepo.delete(condition.id);
      return { removed: true, pendingSync: false };
    }
    Object.assign(condition, {
      verificationStatus: ENTERED_IN_ERROR,
      lastEncounterId: encounterId,
      ...SYNC_RESET,
      updatedBy: actor.userId,
    });
    await this.conditionRepo.save(condition);
    return { removed: true, pendingSync: true };
  }

  /** Aturan isian kondisi (FHIR con-4 + tanggal masuk akal) */
  private conditionFields(
    v: {
      clinicalStatus: string;
      verificationStatus: string;
      severity: string | null;
      onsetDate: string | null;
      abatementDate: string | null;
      note: string | null;
    },
    isNew: boolean,
  ) {
    const today = todayWib();
    const status = v.clinicalStatus as ClinicalStatus;
    for (const [label, date] of [
      ['mulai', v.onsetDate],
      ['sembuh', v.abatementDate],
    ] as const) {
      if (!date) continue;
      if (!validDate(date))
        throw new BadRequestException(`Tanggal ${label} tidak valid`);
      if (date > today)
        throw new BadRequestException(
          `Tanggal ${label} tidak boleh di masa depan`,
        );
      if (date < MIN_FHIR_DATE && label === 'sembuh')
        throw new BadRequestException(
          'Tanggal sembuh tidak boleh sebelum 3 Juni 2014',
        );
    }
    if (v.abatementDate && !ABATED_STATUSES.includes(status)) {
      throw new BadRequestException(
        'Tanggal sembuh hanya diisi bila status Sembuh, Tidak aktif, atau Remisi',
      );
    }
    if (v.onsetDate && v.abatementDate && v.abatementDate < v.onsetDate) {
      throw new BadRequestException(
        'Tanggal sembuh tidak boleh sebelum tanggal mulai',
      );
    }
    if (isNew && v.verificationStatus === ENTERED_IN_ERROR) {
      throw new BadRequestException('Status verifikasi tidak valid');
    }
    return {
      clinicalStatus: status,
      verificationStatus: v.verificationStatus,
      severity: v.severity || null,
      onsetDate: v.onsetDate || null,
      // Ditandai sembuh tanpa tanggal → hari ini
      abatementDate: v.abatementDate || (status === 'resolved' ? today : null),
      note: v.note?.trim() || null,
    };
  }

  private async findCondition(
    id: number,
    clinicId: number,
    encounter: Encounter,
  ): Promise<PatientCondition> {
    const c = await this.conditionRepo.findOne({ where: { id, clinicId } });
    if (!c || c.patientId !== encounter.patientId || isRemovedCondition(c)) {
      throw new NotFoundException('Kondisi tidak ditemukan');
    }
    return c;
  }

  // ── Observasi (Observation) ────────────────────────────────────────────

  async createObservation(
    encounterId: number,
    clinicId: number,
    dto: CreateObservationDto,
    actor: Actor,
  ): Promise<ClinicalObservation> {
    const encounter = await this.getEncounter(encounterId, clinicId, actor);
    const value = this.observationValue(dto.observationKey, dto);
    return this.observationRepo.save(
      this.observationRepo.create({
        clinicId,
        patientId: encounter.patientId,
        encounterId,
        observationKey: dto.observationKey,
        ...value,
        effectiveAt: this.effectiveAt(dto.effectiveAt),
        note: dto.note?.trim() || null,
        status: 'final',
        ...SYNC_RESET,
        createdBy: actor.userId,
      }),
    );
  }

  async updateObservation(
    encounterId: number,
    clinicId: number,
    id: number,
    dto: UpdateObservationDto,
    actor: Actor,
  ): Promise<ClinicalObservation> {
    const obs = await this.findObservation(id, encounterId, clinicId, actor);
    const value = this.observationValue(obs.observationKey, {
      value: dto.value === undefined ? obs.valueNumber : dto.value,
      valueCode: dto.valueCode === undefined ? obs.valueCode : dto.valueCode,
    });
    Object.assign(obs, value, {
      ...(dto.effectiveAt
        ? { effectiveAt: this.effectiveAt(dto.effectiveAt) }
        : {}),
      ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
      ...SYNC_RESET,
      updatedBy: actor.userId,
    });
    return this.observationRepo.save(obs);
  }

  async removeObservation(
    encounterId: number,
    clinicId: number,
    id: number,
    actor: Actor,
  ): Promise<{ removed: true; pendingSync: boolean }> {
    const obs = await this.findObservation(id, encounterId, clinicId, actor);
    if (!obs.satusehatId) {
      await this.observationRepo.delete(obs.id);
      return { removed: true, pendingSync: false };
    }
    Object.assign(obs, {
      status: ENTERED_IN_ERROR,
      ...SYNC_RESET,
      updatedBy: actor.userId,
    });
    await this.observationRepo.save(obs);
    return { removed: true, pendingSync: true };
  }

  /** Nilai sesuai katalog: angka dalam rentang & desimal, atau jawaban terdaftar */
  private observationValue(
    key: string,
    dto: { value?: number | null; valueCode?: string | null },
  ): { valueNumber: number | null; valueCode: string | null } {
    const def = OBSERVATION_BY_KEY.get(key);
    if (!def) throw new BadRequestException('Jenis observasi tidak dikenal');
    if (def.kind === 'coded') {
      const answer = def.answers!.find((a) => a.code === dto.valueCode);
      if (!answer) {
        throw new BadRequestException(`Pilih jawaban untuk ${def.label}`);
      }
      return { valueNumber: null, valueCode: answer.code };
    }
    const raw = dto.value;
    if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) {
      throw new BadRequestException(`Nilai ${def.label} wajib diisi`);
    }
    const value = Number(Number(raw).toFixed(def.decimals ?? 2));
    if (
      (def.min !== undefined && value < def.min) ||
      (def.max !== undefined && value > def.max)
    ) {
      throw new BadRequestException(
        `${def.label} harus antara ${def.min} dan ${def.max} ${def.unit ?? ''}`.trim(),
      );
    }
    return { valueNumber: value, valueCode: null };
  }

  private effectiveAt(value?: string): Date {
    if (!value) return new Date();
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Waktu pemeriksaan tidak valid');
    }
    if (d.getTime() > Date.now() + CLOCK_SKEW_MS) {
      throw new BadRequestException(
        'Waktu pemeriksaan tidak boleh di masa depan',
      );
    }
    if (d < new Date(`${MIN_FHIR_DATE}T00:00:00Z`)) {
      throw new BadRequestException(
        'Waktu pemeriksaan tidak boleh sebelum 3 Juni 2014',
      );
    }
    return d;
  }

  private async findObservation(
    id: number,
    encounterId: number,
    clinicId: number,
    actor: Actor,
  ): Promise<ClinicalObservation> {
    await this.getEncounter(encounterId, clinicId, actor);
    const obs = await this.observationRepo.findOne({
      where: { id, clinicId, encounterId },
    });
    if (!obs || obs.status === ENTERED_IN_ERROR) {
      throw new NotFoundException('Observasi tidak ditemukan');
    }
    return obs;
  }

  // ── Kirim ke SATUSEHAT ─────────────────────────────────────────────────

  /**
   * Kirim (ulang) kunjungan ini. Resource yang sudah ada di-PUT, jadi tidak
   * membuat data ganda. Hasil yang dikembalikan hanya langkah prasyarat dan
   * Kondisi/Observasi supaya mudah dibaca di form.
   */
  async send(encounterId: number, clinicId: number, actor: Actor) {
    await this.getEncounter(encounterId, clinicId, actor);
    const { steps } = await this.syncOrchestrator.syncEncounterFull(
      encounterId,
      clinicId,
    );
    const relevant = steps.filter(
      (s) =>
        s.localType === 'cond_problem' ||
        s.localType.startsWith('clin_obs_') ||
        s.step.startsWith('03. Daftar Masalah') ||
        s.step.startsWith('04. Observasi') ||
        (s.status === 'failed' && /^0[0-2]\./.test(s.step)),
    );
    const failed = relevant.filter((s) => s.status === 'failed');
    return {
      success: failed.length === 0 && steps.length > 0,
      sent: relevant.filter((s) => s.status === 'success').length,
      failed: failed.length,
      steps: relevant,
    };
  }

  /** Dokter/perawat hanya boleh mengakses kunjungannya sendiri (sama dengan modul kunjungan) */
  private async getEncounter(
    encounterId: number,
    clinicId: number,
    actor: Actor,
  ): Promise<Encounter> {
    const encounter = await this.encounterRepo.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Kunjungan dengan ID ${encounterId} tidak ditemukan`,
      );
    }
    if (isClinician(actor.role)) {
      const own: unknown[] = await this.encounterRepo.query(
        'SELECT id FROM practitioners WHERE id = ? AND user_id = ? LIMIT 1',
        [encounter.practitionerId, actor.userId],
      );
      if (!own.length) {
        throw new ForbiddenException('Akses ditolak: bukan kunjungan Anda');
      }
    }
    return encounter;
  }
}

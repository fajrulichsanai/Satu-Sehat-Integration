import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { EncounterSoapNote } from '../encounter-soap-notes/entities/encounter-soap-note.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SatusehatResourceLink } from '../satusehat/sync/entities/satusehat-resource-link.entity';
import { SatusehatClientService } from '../satusehat/satusehat-client.service';
import { readableFhirError } from '../satusehat/fhir/fhir-error';
import { withEffectiveCredentials } from '../satusehat/satusehat-credentials';
import { TerminologyService } from '../terminology/terminology.service';
import { Referral } from './entities/referral.entity';
import {
  CreateReferralDto,
  SearchCandidatesDto,
  SendReferralDto,
} from './dto/referral.dto';
import { CARE_TYPES, SERVICE_GROUPS, TRANSPORTS } from './referral-codes';
import { HEALTHCARE_PROFESSIONALS, POLI_TUJUAN } from './referral-codes.data';
import {
  AnswerValue,
  ReferralContext,
  answersToItems,
  areaItems,
  buildCandidateTask,
  buildPreRequestTask,
  buildReferralBundle,
  bundleResourceIds,
  parseCandidates,
  parseQuestionnaires,
  referralNumberOf,
} from './referral-fhir';

const POLI = new Map(POLI_TUJUAN.map(([c, d]) => [c, d]));
const PROFESSIONALS = new Map(HEALTHCARE_PROFESSIONALS.map(([c, d]) => [c, d]));
const GROUPS = new Map(SERVICE_GROUPS.map(([c, d]) => [c, d]));

/** localType diagnosis SOAP di satusehat_resource_links (lihat sync orchestrator) */
const diagnosisLinkType = (code: string) =>
  `soap_dx:icd10:${code}`.slice(0, 50);

/**
 * Rujukan Pasien — Playbook SATUSEHAT "Rujukan Pasien" v6.1, alur Rawat Jalan:
 *  1. Pra permintaan kandidat (Task referral-pre-request) → kuesioner kriteria
 *  2. Pencarian kandidat (Task request-referral-candidate) → rekomendasi RS
 *  3. Pengiriman rujukan (Bundle ServiceRequest + CarePlan) → Nomor Rujukan Nasional
 * Tiap langkah dikirim sekali; ID dari SATUSEHAT disimpan agar tidak dobel.
 */
@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);
  /** Jeda antar-pengecekan Task yang diproses asinkron oleh SATUSEHAT Rujukan */
  static pollDelayMs = 1500;
  static pollAttempts = 4;

  constructor(
    @InjectRepository(Referral)
    private readonly repo: Repository<Referral>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(EncounterSoapNote)
    private readonly soapRepo: Repository<EncounterSoapNote>,
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(SatusehatResourceLink)
    private readonly linkRepo: Repository<SatusehatResourceLink>,
    private readonly terminology: TerminologyService,
    private readonly client: SatusehatClientService,
  ) {}

  options() {
    return {
      careTypes: Object.entries(CARE_TYPES).map(([value, c]) => ({
        value,
        label: c.label,
      })),
      serviceGroups: SERVICE_GROUPS.map(([value, label]) => ({ value, label })),
      specialties: POLI_TUJUAN.map(([value, label]) => ({ value, label })),
      performerTypes: HEALTHCARE_PROFESSIONALS.map(([value, label]) => ({
        value,
        label,
      })),
      transports: TRANSPORTS.map(([value, , label]) => ({ value, label })),
    };
  }

  async list(encounterId: number, clinicId: number) {
    await this.getEncounter(encounterId, clinicId);
    return this.repo.find({
      where: { clinicId, encounterId },
      order: { createdAt: 'DESC' },
    });
  }

  async history(patientId: number, clinicId: number) {
    return this.repo.find({
      where: { clinicId, patientId, status: In(['sent', 'local']) },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    encounterId: number,
    clinicId: number,
    dto: CreateReferralDto,
    userId: number,
  ) {
    const encounter = await this.getEncounter(encounterId, clinicId);
    const codes = [
      dto.primaryDiagnosis.trim().toUpperCase(),
      ...(dto.secondaryDiagnoses ?? []).map((c) => c.trim().toUpperCase()),
    ];
    const concepts = await this.terminology.resolve(
      codes.map((code) => ({ system: 'icd10' as const, code })),
    );
    const coding = (code: string) => ({
      code,
      display: concepts.get(`icd10:${code}`)!.display,
    });
    const specialty = POLI.get(dto.specialty);
    if (!specialty) throw new BadRequestException('Poli tujuan tidak dikenal');
    const group = GROUPS.get(dto.serviceGroup);
    if (!group) throw new BadRequestException('Kelompok layanan tidak dikenal');
    let performerType: { code: string; display: string } | null = null;
    if (dto.performerType) {
      const display = PROFESSIONALS.get(dto.performerType);
      if (!display)
        throw new BadRequestException('Jenis tenaga kesehatan tidak dikenal');
      performerType = { code: dto.performerType, display };
    }

    const ref = await this.repo.save(
      this.repo.create({
        clinicId,
        encounterId,
        patientId: encounter.patientId,
        careType: dto.careType,
        status: dto.manual ? 'local' : 'draft',
        primaryDiagnosis: coding(codes[0]),
        secondaryDiagnoses: [...new Set(codes.slice(1))]
          .filter((c) => c !== codes[0])
          .map(coding),
        serviceGroup: { code: dto.serviceGroup, display: group },
        specialty: { code: dto.specialty, display: specialty },
        performerType,
        reason: dto.reason.trim(),
        patientInstruction: dto.patientInstruction?.trim() || null,
        plannedDate: dto.plannedDate.slice(0, 10),
        pcareNumber: dto.pcareNumber?.trim() || null,
        targetName: dto.manual ? dto.targetName!.trim() : null,
        createdBy: userId,
        updatedBy: userId,
      }),
    );
    if (dto.manual) return ref;
    return this.startPreRequest(ref, encounter);
  }

  /** Ulangi langkah yang belum berhasil (mis. kunjungan baru saja dikirim) */
  async retry(id: number, clinicId: number) {
    const ref = await this.get(id, clinicId);
    if (ref.status === 'draft') {
      const encounter = await this.getEncounter(ref.encounterId, clinicId);
      return this.startPreRequest(ref, encounter);
    }
    if (ref.status === 'candidates' && !ref.candidates?.length) {
      return this.refreshCandidates(ref);
    }
    if (ref.status === 'sent' && !ref.referralNumber && ref.serviceRequestId) {
      await this.fetchReferralNumber(ref);
      return this.repo.save(ref);
    }
    return ref;
  }

  async searchCandidates(
    id: number,
    clinicId: number,
    dto: SearchCandidatesDto,
  ) {
    const ref = await this.get(id, clinicId);
    if (!['criteria', 'candidates'].includes(ref.status))
      throw new BadRequestException(
        'Rujukan ini tidak sedang menunggu pencarian RS tujuan',
      );
    const encounter = await this.getEncounter(ref.encounterId, clinicId);
    const ctx = await this.context(ref, encounter);

    const q = ref.questionnaires ?? { criteria: null, area: null };
    let criteriaItems: Record<string, any>[];
    let areaQr: Record<string, any>[];
    try {
      criteriaItems = q.criteria
        ? answersToItems(
            q.criteria.item ?? [],
            dto.criteria as Record<string, AnswerValue>,
          )
        : [];
      if (q.area && dto.areaAnswers) {
        areaQr = answersToItems(
          q.area.item ?? [],
          dto.areaAnswers as Record<string, AnswerValue>,
        );
        if (!areaQr.length) throw new Error('Pilih wilayah rujukan');
      } else if (dto.area) {
        areaQr = areaItems(dto.area);
      } else {
        // Tanpa kuesioner wilayah: pakai wilayah alamat klinik (profil SATUSEHAT)
        const area = await this.clinicArea(clinicId);
        if (!area)
          throw new Error(
            'Pilih wilayah rujukan, atau lengkapi provinsi & kabupaten/kota di profil SATUSEHAT klinik',
          );
        dto.area = area;
        areaQr = areaItems(area);
      }
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (q.criteria && !criteriaItems.length)
      throw new BadRequestException('Jawab kuesioner kriteria rujukan');

    const task = buildCandidateTask(
      ref,
      ctx,
      criteriaItems,
      areaQr,
      new Date(),
    );
    // Pencarian ulang memakai identifier baru (Task baru, bukan duplikat)
    task.identifier[0].value = `REF-${ref.id}-CAND-${Date.now().toString(36)}`;
    const { status, data } = await this.client.sendFhirResource(
      clinicId,
      'POST',
      'Task',
      task,
    );
    if (status < 200 || status >= 300 || !data?.id) {
      return this.fail(
        ref,
        `Pencarian RS rujukan ditolak SATUSEHAT: ${readableFhirError(data)}`,
      );
    }
    ref.status = 'candidates';
    ref.candidateTaskId = String(data.id);
    ref.criteriaAnswers = dto.criteria;
    ref.area = dto.area ?? null;
    ref.candidates = parseCandidates(data);
    ref.lastError = null;
    if (!ref.candidates.length) return this.refreshCandidates(ref);
    return this.repo.save(ref);
  }

  async send(id: number, clinicId: number, dto: SendReferralDto) {
    const ref = await this.get(id, clinicId);
    if (ref.serviceRequestId)
      throw new BadRequestException('Rujukan ini sudah terkirim');
    if (ref.status !== 'candidates')
      throw new BadRequestException('Cari RS rujukan terlebih dahulu');
    const target = (ref.candidates ?? []).find(
      (c) => c.orgId === dto.targetOrgId,
    );
    if (!target)
      throw new BadRequestException(
        'RS tujuan harus dipilih dari rekomendasi SATUSEHAT',
      );
    const encounter = await this.getEncounter(ref.encounterId, clinicId);
    const ctx = await this.context(ref, encounter);
    const bundle = buildReferralBundle(ref, ctx, target, new Date(), {
      serviceRequest: randomUUID(),
      carePlan: randomUUID(),
    });
    const { status, data } = await this.client.postBundle(clinicId, bundle);
    const [srId, cpId] = bundleResourceIds(data);
    if (status < 200 || status >= 300 || !srId) {
      return this.fail(
        ref,
        `Rujukan ditolak SATUSEHAT: ${readableFhirError(data)}`,
      );
    }
    ref.status = 'sent';
    ref.serviceRequestId = srId;
    ref.carePlanId = cpId;
    ref.targetOrgId = target.orgId;
    ref.targetName = target.name;
    ref.sentAt = new Date();
    ref.lastError = null;
    await this.repo.save(ref);
    await this.fetchReferralNumber(ref);
    return this.repo.save(ref);
  }

  async cancel(id: number, clinicId: number) {
    const ref = await this.get(id, clinicId);
    if (ref.status === 'sent')
      throw new BadRequestException(
        'Rujukan yang sudah terkirim ke SATUSEHAT tidak bisa dibatalkan dari sini',
      );
    ref.status = 'cancelled';
    return this.repo.save(ref);
  }

  // ── Langkah SATUSEHAT ──────────────────────────────────────────────────

  private async startPreRequest(ref: Referral, encounter: Encounter) {
    let ctx: ReferralContext;
    try {
      ctx = await this.context(ref, encounter);
    } catch (err) {
      // Disimpan sebagai draft: bisa diulang setelah kunjungan dikirim
      ref.lastError = (err as Error).message;
      return this.repo.save(ref);
    }
    let task: Record<string, any> | null = null;
    if (ref.preTaskId) {
      task = await this.getTask(ref.clinicId, ref.preTaskId);
    } else {
      const { status, data } = await this.client.sendFhirResource(
        ref.clinicId,
        'POST',
        'Task',
        buildPreRequestTask(ref, ctx, new Date()),
      );
      if (status < 200 || status >= 300 || !data?.id) {
        return this.fail(
          ref,
          `Pra permintaan rujukan ditolak SATUSEHAT: ${readableFhirError(data)}`,
          false,
        );
      }
      ref.preTaskId = String(data.id);
      task = data;
    }
    let q = parseQuestionnaires(task ?? {});
    for (
      let i = 0;
      !q.criteria && !q.area && i < ReferralsService.pollAttempts;
      i++
    ) {
      await this.sleep();
      task = await this.getTask(ref.clinicId, ref.preTaskId);
      q = parseQuestionnaires(task ?? {});
    }
    ref.questionnaires = q;
    ref.status = 'criteria';
    ref.lastError =
      q.criteria || q.area
        ? null
        : 'Kuesioner kriteria belum diberikan SATUSEHAT — tetap bisa lanjut memilih wilayah';
    return this.repo.save(ref);
  }

  private async refreshCandidates(ref: Referral) {
    for (let i = 0; i < ReferralsService.pollAttempts; i++) {
      await this.sleep();
      const task = await this.getTask(ref.clinicId, ref.candidateTaskId!);
      const found = parseCandidates(task ?? {});
      if (found.length) {
        ref.candidates = found;
        ref.lastError = null;
        return this.repo.save(ref);
      }
      if (task?.status === 'rejected' || task?.status === 'failed') {
        ref.lastError =
          'SATUSEHAT tidak menemukan RS rujukan yang sesuai — ubah wilayah atau kelompok layanan';
        return this.repo.save(ref);
      }
    }
    ref.lastError =
      'Rekomendasi RS masih diproses SATUSEHAT — coba muat ulang sebentar lagi';
    return this.repo.save(ref);
  }

  private async fetchReferralNumber(ref: Referral) {
    try {
      const { status, data } = await this.client.getFhir(
        ref.clinicId,
        `ServiceRequest/${ref.serviceRequestId}`,
      );
      if (status >= 200 && status < 300)
        ref.referralNumber = referralNumberOf(data);
    } catch (err) {
      this.logger.warn(
        `Nomor rujukan belum terbaca: ${(err as Error).message}`,
      );
    }
  }

  private async getTask(clinicId: number, id: string) {
    const { status, data } = await this.client.getFhir(
      clinicId,
      `Task?_id=${encodeURIComponent(id)}`,
    );
    if (status < 200 || status >= 300) return null;
    if (data?.resourceType === 'Bundle')
      return data.entry?.[0]?.resource ?? null;
    return data ?? null;
  }

  private async clinicArea(clinicId: number) {
    const p = (await this.clinicRepo.findOne({ where: { id: clinicId } }))
      ?.satusehatProfile;
    if (!p?.provinceCode || !p.cityCode) return null;
    return {
      provinceCode: p.provinceCode,
      provinceName: p.provinceName ?? p.provinceCode,
      cityCode: p.cityCode,
      cityName: p.cityName ?? p.cityCode,
    };
  }

  /** ID SATUSEHAT yang wajib sudah ada sebelum merujuk */
  private async context(
    ref: Referral,
    encounter: Encounter,
  ): Promise<ReferralContext> {
    const clinic = withEffectiveCredentials(
      await this.clinicRepo.findOne({ where: { id: ref.clinicId } }),
    );
    const missing: string[] = [];
    if (!clinic?.satusehatOrgId) missing.push('integrasi SATUSEHAT klinik');
    if (!encounter.satusehatEncounterId) missing.push('kunjungan');
    if (!encounter.patient?.satusehatPatientId) missing.push('data pasien');
    if (!encounter.practitioner?.satusehatPractitionerId)
      missing.push('data dokter');
    if (missing.length)
      throw new Error(
        `Belum terkirim ke SATUSEHAT: ${missing.join(', ')}. Kirim kunjungan ke SATUSEHAT dulu, lalu lanjutkan rujukan.`,
      );
    const soap = await this.soapRepo.findOne({
      where: { encounterId: encounter.id },
    });
    const dxCodes = [
      ref.primaryDiagnosis,
      ...(ref.secondaryDiagnoses ?? []),
    ].map((d) => d.code);
    const links = soap
      ? await this.linkRepo.find({
          where: [
            ...dxCodes.map((code) => ({
              clinicId: ref.clinicId,
              localType: diagnosisLinkType(code),
              localId: soap.id,
            })),
            {
              clinicId: ref.clinicId,
              localType: 'soap_chief_complaint',
              localId: soap.id,
            },
          ],
        })
      : [];
    const dxLink = (code: string) =>
      links.find((l) => l.localType === diagnosisLinkType(code))?.satusehatId;
    if (!dxLink(ref.primaryDiagnosis.code))
      throw new Error(
        `Diagnosis ${ref.primaryDiagnosis.code} belum terkirim ke SATUSEHAT. Isi diagnosis di SOAP lalu kirim kunjungan ke SATUSEHAT.`,
      );
    const complaint = links.find((l) => l.localType === 'soap_chief_complaint');
    return {
      orgId: clinic!.satusehatOrgId!,
      orgName: clinic!.name,
      patientId: encounter.patient.satusehatPatientId,
      patientName: encounter.patient.name,
      practitionerId: encounter.practitioner.satusehatPractitionerId,
      practitionerName: encounter.practitioner.name,
      encounterId: encounter.satusehatEncounterId,
      diagnosisConditionIds: dxCodes
        .map(dxLink)
        .filter((x): x is string => !!x),
      supportingInfo: complaint
        ? [
            {
              reference: `Condition/${complaint.satusehatId}`,
              display: 'Anamnesis - Keluhan Utama',
            },
          ]
        : [],
    };
  }

  private async fail(ref: Referral, message: string, throwError = true) {
    ref.lastError = message;
    await this.repo.save(ref);
    this.logger.warn(`Rujukan #${ref.id}: ${message}`);
    if (throwError) throw new BadRequestException(message);
    return ref;
  }

  private sleep() {
    return new Promise((r) => setTimeout(r, ReferralsService.pollDelayMs));
  }

  private async get(id: number, clinicId: number) {
    const ref = await this.repo.findOne({ where: { id, clinicId } });
    if (!ref) throw new NotFoundException('Rujukan tidak ditemukan');
    return ref;
  }

  private async getEncounter(id: number, clinicId: number) {
    const encounter = await this.encounterRepo.findOne({
      where: { id, clinicId },
      relations: { patient: true, practitioner: true },
    });
    if (!encounter) throw new NotFoundException('Kunjungan tidak ditemukan');
    return encounter;
  }
}

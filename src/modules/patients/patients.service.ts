import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { EncounterSoapNote } from '../encounter-soap-notes/entities/encounter-soap-note.entity';
import { Billing } from '../billing/entities/billing.entity';
import {
  SupportingExamImage,
  SupportingExamImageType,
} from '../supporting-exam/entities/supporting-exam-image.entity';
import { PatientRecall } from '../recalls/entities/patient-recall.entity';
import {
  CreatePatientDto,
  PatientQueryDto,
  UpdatePatientDto,
} from './dto/patient.dto';
import { paginate, PaginatedResult } from '../../common/dto/pagination.dto';
import { SatusehatClientService } from '../satusehat/satusehat-client.service';
import { TreatmentPlansService } from '../treatment-plans/treatment-plans.service';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    @InjectRepository(EncounterSoapNote)
    private readonly encounterSoapNoteRepository: Repository<EncounterSoapNote>,
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
    @InjectRepository(SupportingExamImage)
    private readonly supportingExamImageRepository: Repository<SupportingExamImage>,
    @InjectRepository(PatientRecall)
    private readonly patientRecallRepository: Repository<PatientRecall>,
    private readonly dataSource: DataSource,
    private readonly satusehatClient: SatusehatClientService,
    private readonly treatmentPlansService: TreatmentPlansService,
  ) {}

  async findAll(
    clinicId: number,
    query: PatientQueryDto,
  ): Promise<PaginatedResult<Patient>> {
    this.logger.log(
      `[GET-ALL] Mengambil daftar pasien | clinicId=${clinicId}, search=${query.search || '-'}`,
    );
    const qb = this.patientRepository
      .createQueryBuilder('p')
      .where('p.clinicId = :clinicId', { clinicId });

    if (query.search) {
      qb.andWhere(
        '(p.name LIKE :search OR p.noRm LIKE :search OR p.nik = :nik)',
        { search: `%${query.search}%`, nik: query.search },
      );
    }

    if (query.gender) {
      qb.andWhere('p.gender = :gender', { gender: query.gender });
    }

    const sortBy = query.sortBy || 'p.createdAt';
    const validSortColumns = ['p.name', 'p.noRm', 'p.createdAt', 'p.updatedAt'];
    const finalSort = validSortColumns.includes(sortBy)
      ? sortBy
      : 'p.createdAt';
    qb.orderBy(finalSort, query.sortOrder);

    return paginate(qb, query);
  }

  async getReferralSummary(clinicId: number) {
    this.logger.log(
      `[REFERRAL-SUMMARY] Mengambil ringkasan referral | clinicId=${clinicId}`,
    );

    const bySource = await this.patientRepository
      .createQueryBuilder('p')
      .select('p.sumberInformasi', 'sumberInformasi')
      .addSelect('COUNT(*)', 'count')
      .where('p.clinicId = :clinicId', { clinicId })
      .andWhere('p.sumberInformasi IS NOT NULL')
      .groupBy('p.sumberInformasi')
      .orderBy('count', 'DESC')
      .getRawMany<{ sumberInformasi: string; count: string }>();

    const byReferrer = await this.patientRepository
      .createQueryBuilder('p')
      .innerJoin(Patient, 'referrer', 'referrer.id = p.referrerPatientId')
      .select('referrer.id', 'referrerPatientId')
      .addSelect('referrer.name', 'referrerName')
      .addSelect('COUNT(*)', 'referralCount')
      .where('p.clinicId = :clinicId', { clinicId })
      .andWhere('p.referrerPatientId IS NOT NULL')
      .groupBy('referrer.id')
      .addGroupBy('referrer.name')
      .orderBy('referralCount', 'DESC')
      .getRawMany<{
        referrerPatientId: number;
        referrerName: string;
        referralCount: string;
      }>();

    return {
      bySource: bySource.map((row) => ({
        sumberInformasi: row.sumberInformasi,
        count: parseInt(row.count, 10),
      })),
      byReferrer: byReferrer.map((row) => ({
        referrerPatientId: row.referrerPatientId,
        referrerName: row.referrerName,
        referralCount: parseInt(row.referralCount, 10),
      })),
    };
  }

  async findOne(id: number, clinicId: number): Promise<Patient> {
    this.logger.log(
      `[GET] Mengambil data pasien | id=${id}, clinicId=${clinicId}`,
    );
    const patient = await this.patientRepository.findOne({
      where: { id, clinicId },
    });
    if (!patient) {
      this.logger.warn(
        `[GET] Pasien tidak ditemukan | id=${id}, clinicId=${clinicId}`,
      );
      throw new NotFoundException(`Pasien dengan ID ${id} tidak ditemukan`);
    }
    return patient;
  }

  async findEncounters(patientId: number, clinicId: number) {
    await this.findOne(patientId, clinicId);
    const encounters = await this.encounterRepository.find({
      where: { patientId, clinicId },
      select: {
        id: true,
        status: true,
        serviceType: true,
        chiefComplaint: true,
        arrivedTime: true,
        finishedTime: true,
        practitioner: { id: true, name: true },
      },
      relations: { practitioner: true },
      order: { arrivedTime: 'DESC' },
    });
    return encounters.map((e) => ({
      id: e.id,
      status: e.status,
      serviceType: e.serviceType,
      chiefComplaint: e.chiefComplaint,
      arrivedTime: e.arrivedTime,
      finishedTime: e.finishedTime,
      practitionerName: e.practitioner?.name,
    }));
  }

  async findTreatmentPlans(patientId: number, clinicId: number) {
    await this.findOne(patientId, clinicId);
    return this.treatmentPlansService.findByPatient(patientId, clinicId);
  }

  /**
   * Patient Timeline (PRD 5.1) — semua aktivitas pasien digabung jadi satu
   * daftar kronologis, terisi otomatis dari data yang sudah ada (kunjungan,
   * billing, foto klinis, treatment plan, recall). Tidak ada form khusus,
   * murni agregasi read-only.
   */
  async getTimeline(patientId: number, clinicId: number) {
    await this.findOne(patientId, clinicId);

    const encounters = await this.encounterRepository.find({
      where: { patientId, clinicId },
      relations: { practitioner: true },
      order: { arrivedTime: 'DESC' },
    });
    const encounterIds = encounters.map((e) => e.id);

    const [soapNotes, billings, photos, recalls] = await Promise.all([
      encounterIds.length
        ? this.encounterSoapNoteRepository.find({
            where: { encounterId: In(encounterIds) },
          })
        : Promise.resolve([]),
      this.billingRepository.find({
        where: { patientId, clinicId },
        relations: { items: true },
        order: { createdAt: 'DESC' },
      }),
      encounterIds.length
        ? this.supportingExamImageRepository.find({
            where: { encounterId: In(encounterIds) },
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve([]),
      this.patientRecallRepository.find({
        where: { patientId, clinicId },
        relations: { tarif: true },
        order: { dueDate: 'DESC' },
      }),
    ]);

    const soapByEncounter = new Map(soapNotes.map((s) => [s.encounterId, s]));
    const billingsByEncounter = new Map<number, Billing[]>();
    for (const b of billings) {
      const list = billingsByEncounter.get(b.encounterId) ?? [];
      list.push(b);
      billingsByEncounter.set(b.encounterId, list);
    }

    const treatmentPlans = await this.treatmentPlansService.findByPatient(
      patientId,
      clinicId,
    );

    type TimelineItem = {
      type: 'kunjungan' | 'billing' | 'foto' | 'treatment_plan' | 'recall';
      date: string;
      title: string;
      subtitle?: string;
      meta?: Record<string, unknown>;
    };

    const items: TimelineItem[] = [];

    for (const e of encounters) {
      const soap = soapByEncounter.get(e.id);
      const encounterBillings = billingsByEncounter.get(e.id) ?? [];
      const tindakanNames = encounterBillings
        .flatMap((b) => b.items?.map((i) => i.name) ?? [])
        .join(', ');
      items.push({
        type: 'kunjungan',
        date: (e.finishedTime ?? e.arrivedTime).toISOString(),
        title: tindakanNames || e.chiefComplaint || 'Kunjungan',
        subtitle: e.practitioner?.name
          ? `drg. ${e.practitioner.name}`
          : undefined,
        meta: {
          encounterId: e.id,
          status: e.status,
          soapSummary: soap?.assessment || soap?.subjective || null,
        },
      });
    }

    for (const b of billings) {
      items.push({
        type: 'billing',
        date: b.createdAt.toISOString(),
        title: `Invoice ${b.invoiceNumber}`,
        subtitle: `Rp ${Number(b.grandTotal).toLocaleString('id-ID')} · ${b.status}`,
        meta: { billingId: b.id, encounterId: b.encounterId, status: b.status },
      });
    }

    for (const p of photos) {
      items.push({
        type: 'foto',
        date: p.createdAt.toISOString(),
        title: p.category
          ? `Foto ${p.category}`
          : p.imageType === SupportingExamImageType.XRAY
            ? 'Rontgen'
            : 'Foto Klinis',
        subtitle: p.notes || undefined,
        meta: { imageId: p.id, fileUrl: p.fileUrl, encounterId: p.encounterId },
      });
    }

    for (const r of recalls) {
      items.push({
        type: 'recall',
        date: new Date(`${r.dueDate}T00:00:00`).toISOString(),
        title: `Recall: ${r.tarif?.name ?? 'Kontrol'}`,
        subtitle: r.status,
        meta: { recallId: r.id, status: r.status },
      });
    }

    for (const tp of treatmentPlans) {
      items.push({
        type: 'treatment_plan',
        date: new Date(tp.createdAt).toISOString(),
        title: tp.label || tp.treatmentType,
        subtitle: `${tp.status} · tahap ${tp.currentStage}/${tp.totalStages ?? '-'}`,
        meta: { treatmentPlanId: tp.id, status: tp.status },
      });
    }

    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return items;
  }

  async create(
    clinicId: number,
    dto: CreatePatientDto,
    noRmOverride?: string,
  ): Promise<Patient> {
    this.logger.log(
      `[CREATE] Membuat pasien baru | clinicId=${clinicId}, name=${dto.name}, nik=${dto.nik || 'bayi'}`,
    );
    if (dto.nik) {
      await this.checkDuplicateNik(dto.nik, clinicId);
    }

    const saved = await this.createWithNoRmRetry(clinicId, dto, noRmOverride);

    this.logger.log(
      `[CREATE] Pasien berhasil dibuat | id=${saved.id}, noRm=${saved.noRm}, clinicId=${clinicId}`,
    );
    return saved;
  }

  private async createWithNoRmRetry(
    clinicId: number,
    dto: CreatePatientDto,
    noRmOverride?: string,
    attempt = 1,
  ): Promise<Patient> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Data migration (see PatientImportService) passes noRmOverride to
        // preserve a clinic's existing RM numbers instead of renumbering —
        // generateNoRm's own scan already excludes non-numeric/legacy-style
        // no_rm values for exactly this reason, so the two schemes coexist
        // without colliding on the sequence.
        const noRm = noRmOverride || (await this.generateNoRm(manager, clinicId));
        const patient = manager.create(Patient, {
          clinicId,
          noRm,
          nik: dto.nik,
          nikIbu: dto.nikIbu,
          namaWali: dto.namaWali,
          hubunganWali: dto.hubunganWali,
          birthOrder: dto.birthOrder,
          name: dto.name,
          birthDate: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          phone: dto.phone,
          email: dto.email,
          pekerjaan: dto.pekerjaan,
          address: dto.address,
          kelurahan: dto.kelurahan,
          kecamatan: dto.kecamatan,
          city: dto.city,
          province: dto.province,
          postalCode: dto.postalCode,
          maritalStatus: dto.maritalStatus,
          sumberInformasi: dto.sumberInformasi,
          detailSumber: dto.detailSumber,
          referrerPatientId: dto.referrerPatientId,
          golonganDarah: dto.golonganDarah,
          rhesus: dto.rhesus,
          punyaAlergi: dto.punyaAlergi ?? false,
          catatanAlergi: dto.catatanAlergi,
          riwayatHipertensi: dto.riwayatHipertensi ?? false,
          riwayatDiabetes: dto.riwayatDiabetes ?? false,
          riwayatParuParu: dto.riwayatParuParu ?? false,
          riwayatSyaraf: dto.riwayatSyaraf ?? false,
          riwayatSistemikLainnya: dto.riwayatSistemikLainnya ?? false,
          catatanSistemikLainnya: dto.catatanSistemikLainnya,
          alergiObat: dto.alergiObat ?? false,
          alergiMakanan: dto.alergiMakanan ?? false,
          preferensiKontak: dto.preferensiKontak,
          preferensiJamKontak: dto.preferensiJamKontak,
          catatanPreferensi: dto.catatanPreferensi,
          consentMarketing: dto.consentMarketing ?? false,
          consentTanggal: dto.consentTanggal
            ? new Date(dto.consentTanggal)
            : undefined,
          consentVersion: dto.consentVersion,
        });

        return manager.save(patient);
      });
    } catch (err) {
      const isDuplicateNoRm =
        err instanceof QueryFailedError &&
        String((err as { code?: string }).code) === 'ER_DUP_ENTRY' &&
        String((err as { sqlMessage?: string }).sqlMessage || '').includes(
          'no_rm',
        );
      // An explicit noRmOverride colliding is never auto-regenerated — the
      // caller asked for that specific number (data migration preserving a
      // clinic's existing RM), so silently picking a different one instead
      // would defeat the point. Surface it as a clear conflict.
      if (isDuplicateNoRm && noRmOverride) {
        throw new ConflictException(
          `No. RM "${noRmOverride}" sudah digunakan oleh pasien lain di klinik ini`,
        );
      }
      if (isDuplicateNoRm && !noRmOverride && attempt < 5) {
        return this.createWithNoRmRetry(clinicId, dto, undefined, attempt + 1);
      }
      throw err;
    }
  }

  async update(
    id: number,
    clinicId: number,
    dto: UpdatePatientDto,
  ): Promise<Patient> {
    this.logger.log(
      `[UPDATE] Memperbarui data pasien | id=${id}, clinicId=${clinicId}`,
    );
    const patient = await this.findOne(id, clinicId);

    if (dto.nik && dto.nik !== patient.nik) {
      await this.checkDuplicateNik(dto.nik, clinicId, id);
    }

    Object.assign(patient, {
      nik: dto.nik ?? patient.nik,
      nikIbu: dto.nikIbu ?? patient.nikIbu,
      namaWali: dto.namaWali ?? patient.namaWali,
      hubunganWali: dto.hubunganWali ?? patient.hubunganWali,
      birthOrder: dto.birthOrder ?? patient.birthOrder,
      name: dto.name ?? patient.name,
      birthDate: dto.dateOfBirth
        ? new Date(dto.dateOfBirth)
        : patient.birthDate,
      gender: dto.gender ?? patient.gender,
      phone: dto.phone ?? patient.phone,
      email: dto.email ?? patient.email,
      pekerjaan: dto.pekerjaan ?? patient.pekerjaan,
      address: dto.address ?? patient.address,
      kelurahan: dto.kelurahan ?? patient.kelurahan,
      kecamatan: dto.kecamatan ?? patient.kecamatan,
      city: dto.city ?? patient.city,
      province: dto.province ?? patient.province,
      postalCode: dto.postalCode ?? patient.postalCode,
      maritalStatus: dto.maritalStatus ?? patient.maritalStatus,
      sumberInformasi: dto.sumberInformasi ?? patient.sumberInformasi,
      detailSumber: dto.detailSumber ?? patient.detailSumber,
      referrerPatientId: dto.referrerPatientId ?? patient.referrerPatientId,
      golonganDarah: dto.golonganDarah ?? patient.golonganDarah,
      rhesus: dto.rhesus ?? patient.rhesus,
      punyaAlergi: dto.punyaAlergi ?? patient.punyaAlergi,
      catatanAlergi: dto.catatanAlergi ?? patient.catatanAlergi,
      riwayatHipertensi: dto.riwayatHipertensi ?? patient.riwayatHipertensi,
      riwayatDiabetes: dto.riwayatDiabetes ?? patient.riwayatDiabetes,
      riwayatParuParu: dto.riwayatParuParu ?? patient.riwayatParuParu,
      riwayatSyaraf: dto.riwayatSyaraf ?? patient.riwayatSyaraf,
      riwayatSistemikLainnya:
        dto.riwayatSistemikLainnya ?? patient.riwayatSistemikLainnya,
      catatanSistemikLainnya:
        dto.catatanSistemikLainnya ?? patient.catatanSistemikLainnya,
      alergiObat: dto.alergiObat ?? patient.alergiObat,
      alergiMakanan: dto.alergiMakanan ?? patient.alergiMakanan,
      preferensiKontak: dto.preferensiKontak ?? patient.preferensiKontak,
      preferensiJamKontak:
        dto.preferensiJamKontak ?? patient.preferensiJamKontak,
      catatanPreferensi: dto.catatanPreferensi ?? patient.catatanPreferensi,
      consentMarketing: dto.consentMarketing ?? patient.consentMarketing,
      consentTanggal: dto.consentTanggal
        ? new Date(dto.consentTanggal)
        : patient.consentTanggal,
      consentVersion: dto.consentVersion ?? patient.consentVersion,
    });

    const updated = await this.patientRepository.save(patient);
    this.logger.log(
      `[UPDATE] Data pasien berhasil diperbarui | id=${id}, clinicId=${clinicId}`,
    );
    return updated;
  }

  private async checkDuplicateNik(
    nik: string,
    clinicId: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.patientRepository
      .createQueryBuilder('p')
      .where('p.nik = :nik AND p.clinicId = :clinicId', { nik, clinicId });

    if (excludeId) {
      qb.andWhere('p.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) {
      this.logger.warn(
        `[CREATE] NIK duplikat ditemukan | nik=${nik}, clinicId=${clinicId}`,
      );
      throw new ConflictException(
        `Pasien dengan NIK ${nik} sudah terdaftar di klinik ini`,
      );
    }
  }

  async remove(id: number, clinicId: number): Promise<void> {
    this.logger.log(
      `[DELETE] Menghapus pasien | id=${id}, clinicId=${clinicId}`,
    );
    const patient = await this.findOne(id, clinicId);

    const [{ total: encounterCount }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM encounters WHERE patient_id = ?`,
      [id],
    );
    const [{ total: billingCount }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM billings WHERE patient_id = ?`,
      [id],
    );

    if (parseInt(encounterCount, 10) > 0 || parseInt(billingCount, 10) > 0) {
      this.logger.warn(
        `[DELETE] Pasien memiliki riwayat kunjungan/billing | id=${id}`,
      );
      throw new ConflictException(
        'Pasien tidak dapat dihapus karena memiliki riwayat kunjungan atau transaksi. Hapus atau pindahkan data terkait terlebih dahulu.',
      );
    }

    try {
      await this.patientRepository.remove(patient);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          'Pasien tidak dapat dihapus karena masih memiliki data terkait.',
        );
      }
      throw err;
    }
    this.logger.log(
      `[DELETE] Pasien berhasil dihapus | id=${id}, clinicId=${clinicId}`,
    );
  }

  async searchSatusehat(nik: string, clinicId: number) {
    this.logger.log(
      `[SEARCH] Mencari pasien di SATUSEHAT | nik=${nik}, clinicId=${clinicId}`,
    );
    if (!nik) {
      this.logger.warn(
        `[SEARCH] NIK kosong untuk pencarian SATUSEHAT | clinicId=${clinicId}`,
      );
      throw new BadRequestException('NIK diperlukan untuk pencarian SATUSEHAT');
    }
    return this.satusehatClient.searchPatientByNik(clinicId, nik);
  }

  private async generateNoRm(
    manager: EntityManager,
    clinicId: number,
  ): Promise<string> {
    // Nomor RM sequential per klinik (tidak reset harian/tahunan), format 6 digit: 000001, 000002, dst.
    // Hanya mempertimbangkan no_rm bergaya baru (murni digit, <=6 karakter) agar tidak
    // tercampur dengan format lama (tanggal+urut) yang mungkin masih ada di data historis.
    const result = await manager.query<Array<{ no_rm: string }>>(
      `SELECT no_rm FROM patients
       WHERE clinic_id = ? AND no_rm REGEXP '^[0-9]{1,6}$'
       ORDER BY CAST(no_rm AS UNSIGNED) DESC
       LIMIT 1
       FOR UPDATE`,
      [clinicId],
    );

    const lastSeq = result.length ? parseInt(result[0].no_rm, 10) : 0;
    return String(lastSeq + 1).padStart(6, '0');
  }
}

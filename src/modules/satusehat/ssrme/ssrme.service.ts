import { withEffectiveCredentials } from '../satusehat-credentials';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { UserRole, isClinician } from '../../../enums/user-role.enum';
import { SatusehatClientService } from '../satusehat-client.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';

/**
 * SATUSEHAT Rekam Medis Elektronik (SSRME) — tombol "RME Nasional".
 * Ref: Petunjuk Teknis SSRME v2.0 (1 September 2026).
 *
 *   1. POST /ssrme/v2/ntl/chl → verificationUrl: pasien memberi persetujuan
 *      lewat SATUSEHAT Mobile (atau form darurat bila EMERGENCY)
 *   2. POST /ssrme/v2/ntl/shl → shlinkUrl: dibuka dokter untuk melihat
 *      ringkasan rekam medis nasional pasien (alergi, diagnosis, resep,
 *      tindakan, lab & radiologi)
 *
 * Keduanya memakai 6 atribut: ID SATUSEHAT pasien, dokter penanggung jawab
 * dan organisasi beserta namanya. URL yang dikembalikan bersifat sensitif:
 * tidak disimpan dan tidak dicatat di log.
 */

export interface SsrmeActor {
  userId: number;
  role: UserRole;
}

export interface SsrmeConsentLink {
  verificationUrl: string;
  expiredAt: string | null;
}

export interface SsrmeRecordLink {
  shlinkUrl: string;
  expiredAt: string | null;
  partial: boolean;
  warnings: unknown[];
}

/** Pesan galat SSRME yang aman ditampilkan (tanpa ID/nama). */
function ssrmeError(status: number, data: any): string {
  const raw: string =
    data?.fault?.faultstring ??
    (typeof data?.data === 'string' ? data.data : undefined) ??
    data?.message ??
    `HTTP ${status}`;
  if (/wrong organization/i.test(raw)) {
    return 'Organization ID tidak sesuai dengan kredensial SATUSEHAT klinik';
  }
  // Dokter ada di SATUSEHAT tetapi tidak tercatat praktik (SIP) di fasyankes ini
  if (
    /tidak terdaftar|not registered|not (a )?member|not associated/i.test(raw)
  ) {
    return 'Dokter belum tercatat praktik di fasyankes ini pada SATUSEHAT. SSRME hanya bisa dibuka oleh nakes dengan SIP aktif yang terdaftar untuk Organization ID klinik ini (cek SIP dokter di SISDMK/SATUSEHAT). Di Sandbox, gunakan data dokter uji yang terdaftar pada organisasi sandbox.';
  }
  if (/patient with id/i.test(raw))
    return 'Pasien tidak ditemukan di SATUSEHAT';
  if (/practitioner with id/i.test(raw)) {
    return 'Dokter tidak ditemukan di SATUSEHAT (cek NIK & SIP)';
  }
  if (/access token/i.test(raw))
    return 'Token SATUSEHAT tidak valid — coba lagi';
  return `SSRME menolak permintaan (${raw.slice(0, 120)})`;
}

@Injectable()
export class SsrmeService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    private readonly client: SatusehatClientService,
    private readonly orchestrator: SyncOrchestratorService,
  ) {}

  /** Langkah 1 — link persetujuan (consent) pasien. */
  async createConsentLink(
    clinicId: number,
    encounterId: number,
    actor: SsrmeActor,
    emergency = false,
  ): Promise<SsrmeConsentLink> {
    const body = await this.attributes(clinicId, encounterId, actor);
    const { status, data } = await this.client.postSsrme(clinicId, 'chl', {
      ...body,
      ...(emergency ? { type_medical_summary: 'EMERGENCY' } : {}),
    });
    const url = data?.data?.verificationUrl;
    if (status >= 300 || data?.success === false || typeof url !== 'string') {
      throw this.failure(status, data);
    }
    return { verificationUrl: url, expiredAt: data.data.expiredAt ?? null };
  }

  /** Langkah 2 — link SSRME untuk dokter (butuh consent pasien). */
  async openRecord(
    clinicId: number,
    encounterId: number,
    actor: SsrmeActor,
  ): Promise<SsrmeRecordLink> {
    const body = await this.attributes(clinicId, encounterId, actor);
    const { status, data } = await this.client.postSsrme(clinicId, 'shl', body);
    if (status === 403 || data?.data?.code === 'CONSENT_REQUIRED') {
      throw new ConflictException({
        message:
          'Pasien belum memberi persetujuan (consent) akses RME Nasional',
        code: 'CONSENT_REQUIRED',
      });
    }
    const url = data?.data?.shlinkUrl;
    if (status >= 300 || data?.success === false || typeof url !== 'string') {
      throw this.failure(status, data);
    }
    return {
      shlinkUrl: url,
      expiredAt: data.data.expiredAt ?? null,
      partial: data.data.partial === true,
      warnings: Array.isArray(data.data.warnings) ? data.data.warnings : [],
    };
  }

  private failure(status: number, data: any) {
    const message = ssrmeError(status, data);
    return status >= 500 || status === 0
      ? new BadGatewayException(message)
      : new BadRequestException(message);
  }

  /** 6 atribut CHLink/SHLink untuk satu kunjungan. */
  private async attributes(
    clinicId: number,
    encounterId: number,
    actor: SsrmeActor,
  ) {
    const encounter = await this.encounterRepo.findOne({
      where: { id: encounterId, clinicId },
      relations: { patient: true, practitioner: true },
    });
    if (!encounter) throw new NotFoundException('Kunjungan tidak ditemukan');
    if (!encounter.practitioner) {
      throw new BadRequestException(
        'Kunjungan belum memiliki dokter penanggung jawab',
      );
    }
    // Dokter hanya boleh membuka rekam medis pasien yang ia tangani
    if (
      isClinician(actor.role) &&
      encounter.practitioner.userId !== actor.userId
    ) {
      throw new ForbiddenException('Akses ditolak: bukan pasien Anda');
    }
    const clinic = withEffectiveCredentials(
      await this.clinicRepo.findOne({ where: { id: clinicId } }),
    );
    if (!clinic?.satusehatOrgId) {
      throw new BadRequestException(
        'Kredensial SATUSEHAT belum diatur — isi SATUSEHAT_ORGANIZATION_ID, SATUSEHAT_CLIENT_ID, SATUSEHAT_CLIENT_SECRET di env server (atau Konfigurasi klinik)',
      );
    }
    const [patientId, practitionerId] = await Promise.all([
      this.orchestrator.patientIhsId(clinicId, encounter.patient),
      this.orchestrator.practitionerIhsId(clinicId, encounter.practitioner),
    ]);
    return {
      patient_id: patientId,
      patient_name: encounter.patient.name,
      practitioner_id: practitionerId,
      practitioner_name: encounter.practitioner.name,
      organization_id: clinic.satusehatOrgId,
      organization_name: clinic.name,
    };
  }
}

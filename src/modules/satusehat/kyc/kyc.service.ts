import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { SatusehatClientService } from '../satusehat-client.service';
import {
  decryptKycMessage,
  encryptKycMessage,
  generateKycKeyPair,
  isEncryptedMessage,
  kycPublicKey,
} from './kyc-crypto';

/**
 * KYC — Verifikasi Profil SATUSEHAT Mobile (Juknis KYC Tim IT Faskes v6.4).
 *
 *   1. POST /kyc/v1/generate-url (terenkripsi) → URL iFrame verifikasi untuk
 *      petugas (agent) fasyankes
 *   2. POST /kyc/v1/challenge-code → kode verifikasi pasien per NIK yang
 *      dimasukkan pasien di aplikasi SATUSEHAT Mobile
 *
 * Private key sesi hanya disimpan di memori server (maks. 30 menit) karena
 * respons challenge-code dienkripsi dengan public key milik sesi tersebut.
 * URL iFrame, token, dan kode verifikasi tidak disimpan & tidak dicatat di log.
 */

const SESSION_TTL_MS = 30 * 60 * 1000;

interface KycSession {
  clinicId: number;
  userId: number;
  privateKey: string;
  frameToken: string;
  expiresAt: number;
}

export interface KycUrlResult {
  sessionId: string;
  url: string;
  agentName: string;
  expiresAt: string;
}

export interface KycChallengeResult {
  name: string;
  ihsNumber: string | null;
  challengeCode: string;
  createdAt: string | null;
  expiredAt: string | null;
}

const NIK_PATTERN = /^\d{16}$/;

function kycRawMessage(status: number, data: any): string {
  return String(
    data?.fault?.faultstring ??
      (typeof data?.data === 'string' ? data.data : undefined) ??
      data?.metadata?.message ??
      data?.message ??
      `HTTP ${status}`,
  );
}

/** Penolakan karena format/enkripsi pesan (bukan karena data). */
function isFormatError(status: number, data: any): boolean {
  if (status >= 500 || status === 401 || status === 403) return false;
  if (!data || Object.keys(data).length === 0) return true;
  return /decrypt|encrypt|content.?type|json|format|bad request/i.test(
    kycRawMessage(status, data),
  );
}

/** Pesan galat KYC yang aman ditampilkan. */
export function kycError(status: number, data: any): string {
  const raw = kycRawMessage(status, data);
  if (/decrypt/i.test(raw)) {
    return 'SATUSEHAT gagal membaca pesan terenkripsi KYC — pastikan public key KYC sesuai environment (env SATUSEHAT_KYC_PUBLIC_KEY)';
  }
  if (/access token|unauthori[sz]ed/i.test(raw)) {
    return 'Token SATUSEHAT tidak valid atau klien belum diberi akses KYC';
  }
  if (/not found|tidak ditemukan/i.test(raw)) {
    return 'Data pasien tidak ditemukan di SATUSEHAT (cek NIK & nama sesuai KTP)';
  }
  return `KYC SATUSEHAT menolak permintaan (${raw.slice(0, 120)})`;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly sessions = new Map<string, KycSession>();

  constructor(
    @InjectRepository(Practitioner)
    private readonly practitionerRepo: Repository<Practitioner>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    private readonly client: SatusehatClientService,
  ) {}

  /** Petugas default = data nakes yang tertaut ke akun login. */
  async agentDefaults(clinicId: number, userId: number) {
    const p = await this.practitionerRepo.findOne({
      where: { clinicId, userId },
    });
    return {
      name: p?.name ?? null,
      hasNik: !!(p?.nik && NIK_PATTERN.test(p.nik)),
    };
  }

  async generateUrl(
    clinicId: number,
    userId: number,
    input: { agentName?: string; agentNik?: string },
  ): Promise<KycUrlResult> {
    const linked = await this.practitionerRepo.findOne({
      where: { clinicId, userId },
    });
    const agentName = input.agentName?.trim() || linked?.name;
    const agentNik = input.agentNik?.trim() || linked?.nik;
    if (!agentName || !agentNik || !NIK_PATTERN.test(agentNik)) {
      throw new BadRequestException(
        'Isi nama & NIK (16 digit) petugas yang melakukan verifikasi',
      );
    }

    const { publicKey, privateKey } = generateKycKeyPair();
    const plain = JSON.stringify({
      agent_name: agentName,
      agent_nik: agentNik,
      public_key: publicKey,
    });
    // Juknis: format terenkripsi (text/plain) diutamakan; format JSON tidak
    // terenkripsi juga diterima — dipakai bila pesan terenkripsi ditolak.
    let { status, text } = await this.client.postKyc(
      clinicId,
      'generate-url',
      encryptKycMessage(plain, kycPublicKey()),
    );
    let data = this.parse(text, privateKey);
    if (!data?.data?.url && isFormatError(status, data)) {
      ({ status, text } = await this.client.postKyc(
        clinicId,
        'generate-url',
        plain,
        { 'Content-Type': 'application/json' },
      ));
      data = this.parse(text, privateKey);
    }
    const url = data?.data?.url;
    const frameToken = data?.data?.token;
    if (status >= 300 || typeof url !== 'string' || !url) {
      throw this.failure(status, data);
    }

    this.prune();
    const sessionId = randomUUID();
    const expiresAt = Date.now() + SESSION_TTL_MS;
    this.sessions.set(sessionId, {
      clinicId,
      userId,
      privateKey,
      frameToken: typeof frameToken === 'string' ? frameToken : '',
      expiresAt,
    });
    return {
      sessionId,
      url,
      agentName,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async challengeCode(
    clinicId: number,
    userId: number,
    input: {
      sessionId?: string;
      patientId?: number;
      nik?: string;
      name?: string;
    },
  ): Promise<KycChallengeResult> {
    const session = input.sessionId
      ? this.sessions.get(input.sessionId)
      : undefined;
    if (
      input.sessionId &&
      (!session ||
        session.clinicId !== clinicId ||
        session.userId !== userId ||
        session.expiresAt < Date.now())
    ) {
      throw new BadRequestException(
        'Sesi verifikasi berakhir — klik "Mulai verifikasi" lagi',
      );
    }

    let nik = input.nik?.trim();
    let name = input.name?.trim();
    if (input.patientId) {
      const patient = await this.patientRepo.findOne({
        where: { id: input.patientId, clinicId },
      });
      if (!patient) throw new NotFoundException('Pasien tidak ditemukan');
      nik = nik || patient.nik;
      name = name || patient.name;
    }
    if (!nik || !NIK_PATTERN.test(nik) || !name) {
      throw new BadRequestException(
        'Isi NIK (16 digit) & nama pasien sesuai KTP',
      );
    }

    const plain = JSON.stringify({
      metadata: { method: 'request_per_nik' },
      data: { nik, name },
    });
    // Juknis: JSON biasa. Bila layanan meminta pesan terenkripsi, ulangi
    // dengan amplop KYC + X-Frame-Token dari sesi generate-url.
    const frameHeader: Record<string, string> = session?.frameToken
      ? { 'X-Frame-Token': session.frameToken }
      : {};
    let res = await this.client.postKyc(clinicId, 'challenge-code', plain, {
      'Content-Type': 'application/json',
      ...frameHeader,
    });
    let data = this.parse(res.text, session?.privateKey);
    if (!this.challengeOf(data) && session && isFormatError(res.status, data)) {
      res = await this.client.postKyc(
        clinicId,
        'challenge-code',
        encryptKycMessage(plain, kycPublicKey()),
        frameHeader,
      );
      data = this.parse(res.text, session.privateKey);
    }
    const d = this.challengeOf(data);
    if (res.status >= 300 || !d) throw this.failure(res.status, data);
    return {
      name: typeof d.name === 'string' ? d.name : name,
      ihsNumber: d.ihs_number ? String(d.ihs_number) : null,
      challengeCode: String(d.challenge_code),
      createdAt: d.created_timestamp ?? null,
      expiredAt: d.expired_timestamp ?? null,
    };
  }

  /** Akhiri sesi lebih awal (mis. petugas menutup halaman). */
  endSession(clinicId: number, userId: number, sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (s && s.clinicId === clinicId && s.userId === userId) {
      this.sessions.delete(sessionId);
    }
  }

  private challengeOf(data: any) {
    const d = data?.data;
    return d && d.challenge_code !== undefined && d.challenge_code !== null
      ? d
      : null;
  }

  /** Respons KYC bisa terenkripsi atau JSON biasa (galat). */
  private parse(text: string, privateKey?: string): any {
    try {
      const plain = isEncryptedMessage(text)
        ? privateKey
          ? decryptKycMessage(text, privateKey)
          : '{}'
        : text;
      return JSON.parse(plain);
    } catch (err) {
      this.logger.warn(`Respons KYC tidak terbaca: ${(err as Error).message}`);
      return {};
    }
  }

  private failure(status: number, data: any) {
    const message = kycError(status, data);
    return status >= 500 || status === 0
      ? new BadGatewayException(message)
      : new BadRequestException(message);
  }

  private prune() {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (s.expiresAt < now) this.sessions.delete(id);
    }
  }
}

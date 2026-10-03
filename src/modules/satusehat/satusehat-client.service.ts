import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SatusehatEnvironment } from '../../enums/satusehat-environment.enum';
import { decrypt, encrypt } from '../../common/utils/crypto.util';

const SATUSEHAT_BASE: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]: 'https://api-satusehat-stg.dto.kemkes.go.id',
  [SatusehatEnvironment.PRODUCTION]: 'https://api-satusehat.kemkes.go.id',
};

const AUTH_URL: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]:
    'https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1/accesstoken',
  [SatusehatEnvironment.PRODUCTION]:
    'https://api-satusehat.kemkes.go.id/oauth2/v1/accesstoken',
};

/** Token diperbarui bila sisa masa berlakunya < 5 menit. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Kunci enkripsi client secret — sama dengan kunci data pasien (NIK). */
function secretKey(): string {
  const key = process.env.PATIENT_DATA_ENCRYPTION_KEY;
  if (!key) {
    throw new ServiceUnavailableException(
      'PATIENT_DATA_ENCRYPTION_KEY belum di-set di server',
    );
  }
  return key;
}

export function encryptClientSecret(secret: string): string {
  return encrypt(secret, secretKey());
}

/**
 * Koneksi FHIR ke SATUSEHAT memakai kredensial masing-masing klinik
 * (Organization ID + client id/secret dari portal SATUSEHAT).
 */
@Injectable()
export class SatusehatClientService {
  private readonly logger = new Logger(SatusehatClientService.name);

  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async getAccessToken(clinicId: number): Promise<string> {
    const clinic = await this.loadConfiguredClinic(clinicId);
    if (
      clinic.satusehatToken &&
      clinic.satusehatTokenExpiresAt &&
      clinic.satusehatTokenExpiresAt.getTime() - Date.now() >
        TOKEN_REFRESH_MARGIN_MS
    ) {
      return clinic.satusehatToken;
    }
    return this.refreshToken(clinic);
  }

  /** Paksa minta token baru — dipakai "Test koneksi". */
  async testConnection(clinicId: number): Promise<{ expiresAt: Date }> {
    const clinic = await this.loadConfiguredClinic(clinicId);
    await this.refreshToken(clinic);
    const refreshed = await this.clinicRepository.findOne({
      where: { id: clinicId },
      select: { id: true, satusehatTokenExpiresAt: true },
    });
    return { expiresAt: refreshed!.satusehatTokenExpiresAt as Date };
  }

  async sendFhirResource(
    clinicId: number,
    method: 'POST' | 'PUT',
    path: string,
    body: object,
  ): Promise<{ status: number; data: any }> {
    return this.request(clinicId, method, path, body);
  }

  /** GET ke FHIR SATUSEHAT, mis. `Practitioner?identifier=...` */
  async getFhir(
    clinicId: number,
    pathAndQuery: string,
  ): Promise<{ status: number; data: any }> {
    return this.request(clinicId, 'GET', pathAndQuery);
  }

  /** Cari Patient (Master Patient Index) berdasarkan NIK — Bundle FHIR. */
  async searchPatientByNik(clinicId: number, nik: string): Promise<any> {
    const { data } = await this.getFhir(
      clinicId,
      `Patient?identifier=${encodeURIComponent(`https://fhir.kemkes.go.id/id/nik|${nik}`)}`,
    );
    return data;
  }

  /** Cari Practitioner (SISDMK) berdasarkan NIK — Bundle FHIR. */
  async searchPractitionerByNik(clinicId: number, nik: string): Promise<any> {
    const { data } = await this.getFhir(
      clinicId,
      `Practitioner?identifier=${encodeURIComponent(`https://fhir.kemkes.go.id/id/nik|${nik}`)}`,
    );
    return data;
  }

  private async request(
    clinicId: number,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: object,
  ): Promise<{ status: number; data: any }> {
    const clinic = await this.loadConfiguredClinic(clinicId);
    const token = await this.getAccessToken(clinicId);
    const baseUrl = SATUSEHAT_BASE[clinic.satusehatEnvironment];
    try {
      const response = await fetch(`${baseUrl}/fhir-r4/v1/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, data };
    } catch (err) {
      // Jangan log URL lengkap: query bisa memuat NIK
      this.logger.error(
        `SATUSEHAT ${method} ${path.split('?')[0]} gagal: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException('Koneksi ke SATUSEHAT gagal');
    }
  }

  private async loadConfiguredClinic(clinicId: number): Promise<Clinic> {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });
    if (
      !clinic?.satusehatOrgId ||
      !clinic.satusehatClientId ||
      !clinic.satusehatClientSecret
    ) {
      throw new ServiceUnavailableException(
        'Konfigurasi SATUSEHAT klinik belum lengkap',
      );
    }
    return clinic;
  }

  private async refreshToken(clinic: Clinic): Promise<string> {
    let clientSecret: string;
    try {
      clientSecret = decrypt(
        clinic.satusehatClientSecret as string,
        secretKey(),
      );
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      throw new ServiceUnavailableException(
        'Client secret SATUSEHAT tidak bisa dibaca — simpan ulang konfigurasi',
      );
    }

    const params = new URLSearchParams({
      client_id: clinic.satusehatClientId as string,
      client_secret: clientSecret,
    });

    try {
      const response = await fetch(
        `${AUTH_URL[clinic.satusehatEnvironment]}?grant_type=client_credentials`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        },
      );
      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }
      const data: any = await response.json();
      const expiresAt = new Date(
        Date.now() + parseInt(data.expires_in || '3599', 10) * 1000,
      );
      await this.clinicRepository.update(clinic.id, {
        satusehatToken: data.access_token,
        satusehatTokenExpiresAt: expiresAt,
      });
      return data.access_token;
    } catch (err) {
      this.logger.error(
        `Token SATUSEHAT klinik ${clinic.id} gagal: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Gagal mendapatkan token SATUSEHAT — periksa Client ID, Client Secret, dan environment',
      );
    }
  }
}

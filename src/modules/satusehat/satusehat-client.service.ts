import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../../entities/clinic.entity';
import { SatusehatEnvironment } from '../../enums/satusehat-environment.enum';

const SATUSEHAT_BASE: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]: 'https://api-satusehat-stg.dto.kemkes.go.id',
  [SatusehatEnvironment.PRODUCTION]: 'https://api-satusehat.kemkes.go.id',
};

const AUTH_URL: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]: 'https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1/accesstoken',
  [SatusehatEnvironment.PRODUCTION]: 'https://api-satusehat.kemkes.go.id/oauth2/v1/accesstoken',
};

@Injectable()
export class SatusehatClientService {
  private readonly logger = new Logger(SatusehatClientService.name);

  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async getAccessToken(clinicId: number): Promise<string> {
    const clinic = await this.clinicRepository.findOne({ where: { id: clinicId } });
    if (!clinic?.satusehatClientId || !clinic?.satusehatClientSecret) {
      throw new ServiceUnavailableException('Konfigurasi SATUSEHAT belum lengkap');
    }

    // Return cached token if still valid (>30 min remaining)
    if (clinic.satusehatToken && clinic.satusehatTokenExpiresAt) {
      const expiresIn = clinic.satusehatTokenExpiresAt.getTime() - Date.now();
      if (expiresIn > 30 * 60 * 1000) {
        return clinic.satusehatToken;
      }
    }

    return this.refreshToken(clinic);
  }

  async sendFhirResource(
    clinicId: number,
    method: 'POST' | 'PUT',
    path: string,
    body: object,
  ): Promise<{ status: number; data: any }> {
    const clinic = await this.clinicRepository.findOne({ where: { id: clinicId } });
    if (!clinic) throw new ServiceUnavailableException('Klinik tidak ditemukan');

    const token = await this.getAccessToken(clinicId);
    const baseUrl = SATUSEHAT_BASE[clinic.satusehatEnvironment];

    try {
      const response = await fetch(`${baseUrl}/fhir-r4/v1/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));
      return { status: response.status, data };
    } catch (err) {
      this.logger.error(`SATUSEHAT request failed: ${err.message}`);
      throw new ServiceUnavailableException('Koneksi ke SATUSEHAT gagal');
    }
  }

  async searchPatientByNik(clinicId: number, nik: string): Promise<any> {
    const clinic = await this.clinicRepository.findOne({ where: { id: clinicId } });
    if (!clinic) throw new ServiceUnavailableException('Klinik tidak ditemukan');

    const token = await this.getAccessToken(clinicId);
    const baseUrl = SATUSEHAT_BASE[clinic.satusehatEnvironment];

    try {
      const response = await fetch(
        `${baseUrl}/fhir-r4/v1/Patient?identifier=https://fhir.kemkes.go.id/id/nik|${nik}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return response.json();
    } catch (err) {
      this.logger.error(`SATUSEHAT patient search failed: ${err.message}`);
      throw new ServiceUnavailableException('Pencarian pasien di SATUSEHAT gagal');
    }
  }

  private async refreshToken(clinic: Clinic): Promise<string> {
    const authUrl = AUTH_URL[clinic.satusehatEnvironment];
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clinic.satusehatClientId,
      client_secret: clinic.satusehatClientSecret,
    });

    try {
      const response = await fetch(`${authUrl}?grant_type=client_credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }

      const data: any = await response.json();
      const expiresAt = new Date(Date.now() + parseInt(data.expires_in || '3600') * 1000);

      await this.clinicRepository.update(clinic.id, {
        satusehatToken: data.access_token,
        satusehatTokenExpiresAt: expiresAt,
      });

      return data.access_token;
    } catch (err) {
      this.logger.error(`Token refresh failed: ${err.message}`);
      throw new ServiceUnavailableException('Gagal mendapatkan token SATUSEHAT');
    }
  }
}

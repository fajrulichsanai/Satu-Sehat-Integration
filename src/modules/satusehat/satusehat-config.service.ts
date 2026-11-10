import { credentialSource, envCredentials } from './satusehat-credentials';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import {
  SatusehatClientService,
  encryptClientSecret,
} from './satusehat-client.service';
import { SaveSatusehatConfigDto } from './dto/satusehat-config.dto';

/** Konfigurasi SATUSEHAT per klinik. Client secret tidak pernah dikembalikan. */
@Injectable()
export class SatusehatConfigService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    private readonly client: SatusehatClientService,
  ) {}

  async get(clinicId: number) {
    const clinic = await this.load(clinicId);
    const source = credentialSource(clinic);
    const env = envCredentials();
    return {
      configured: source !== null,
      /** 'clinic' = kredensial klinik sendiri, 'env' = Kode Akses API dari env server */
      source,
      envAvailable: !!env,
      envOrganizationId: env?.orgId ?? null,
      envEnvironment: env?.environment ?? null,
      organizationId: clinic.satusehatOrgId,
      clientId: clinic.satusehatClientId,
      hasClientSecret: !!clinic.satusehatClientSecret,
      environment: clinic.satusehatEnvironment,
      poliLocationId: clinic.satusehatPoliLocationId,
      tokenValidUntil:
        clinic.satusehatTokenExpiresAt &&
        clinic.satusehatTokenExpiresAt.getTime() > Date.now()
          ? clinic.satusehatTokenExpiresAt
          : null,
    };
  }

  async save(clinicId: number, dto: SaveSatusehatConfigDto, userId: number) {
    const clinic = await this.load(clinicId);
    const secret = dto.clientSecret?.trim();
    if (!secret && !clinic.satusehatClientSecret) {
      throw new BadRequestException('Client secret wajib diisi');
    }
    const credentialsChanged =
      !!secret ||
      clinic.satusehatClientId !== dto.clientId.trim() ||
      clinic.satusehatEnvironment !== dto.environment;

    clinic.satusehatOrgId = dto.organizationId.trim();
    clinic.satusehatClientId = dto.clientId.trim();
    if (secret) clinic.satusehatClientSecret = encryptClientSecret(secret);
    clinic.satusehatEnvironment = dto.environment;
    clinic.satusehatPoliLocationId = dto.poliLocationId?.trim() || null;
    if (credentialsChanged) {
      // Kredensial berubah → buang token lama
      clinic.satusehatToken = null;
      clinic.satusehatTokenExpiresAt = null;
    }
    clinic.updatedBy = userId;
    await this.clinicRepo.save(clinic);
    return this.get(clinicId);
  }

  /** Minta token baru ke SATUSEHAT untuk memastikan kredensial benar. */
  async test(clinicId: number) {
    const { expiresAt } = await this.client.testConnection(clinicId);
    return { connected: true, tokenExpiresAt: expiresAt };
  }

  private async load(clinicId: number): Promise<Clinic> {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Klinik tidak ditemukan');
    return clinic;
  }
}

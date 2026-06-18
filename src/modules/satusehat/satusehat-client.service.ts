import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SatusehatEnvironment } from '../../enums/satusehat-environment.enum';
import { decrypt } from '../../common/utils/crypto.util';

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

@Injectable()
export class SatusehatClientService {
  private readonly logger = new Logger(SatusehatClientService.name);

  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.get<string>(
      'ENCRYPTION_KEY',
      'default-key-32-chars-padded!!!!!',
    );
  }

  async getAccessToken(clinicId: number): Promise<string> {
    throw new ServiceUnavailableException(
      'SATUSEHAT integration has been deprecated and is no longer available',
    );
  }

  async sendFhirResource(
    clinicId: number,
    method: 'POST' | 'PUT',
    path: string,
    body: object,
  ): Promise<{ status: number; data: any }> {
    throw new ServiceUnavailableException(
      'SATUSEHAT integration has been deprecated and is no longer available',
    );
  }

  async searchPatientByNik(clinicId: number, nik: string): Promise<any> {
    throw new ServiceUnavailableException(
      'SATUSEHAT integration has been deprecated and is no longer available',
    );
  }

  private async refreshToken(clinic: Clinic): Promise<string> {
    throw new ServiceUnavailableException(
      'SATUSEHAT integration has been deprecated and is no longer available',
    );
  }
}

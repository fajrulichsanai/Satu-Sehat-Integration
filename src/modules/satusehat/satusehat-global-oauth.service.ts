import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SatusehatEnvironment } from '../../enums/satusehat-environment.enum';

const AUTH_URL: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]:
    'https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1/accesstoken',
  [SatusehatEnvironment.PRODUCTION]:
    'https://api-satusehat.kemkes.go.id/oauth2/v1/accesstoken',
};

interface CachedToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class SatusehatGlobalOauthService {
  private readonly logger = new Logger(SatusehatGlobalOauthService.name);
  private cachedTokens: Map<SatusehatEnvironment, CachedToken> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async getAccessToken(
    environment: SatusehatEnvironment = SatusehatEnvironment.SANDBOX,
  ): Promise<string> {
    const cached = this.cachedTokens.get(environment);
    if (cached && cached.expiresAt.getTime() - Date.now() > 30 * 60 * 1000) {
      return cached.token;
    }

    return this.refreshToken(environment);
  }

  private async refreshToken(
    environment: SatusehatEnvironment,
  ): Promise<string> {
    const clientId = this.configService.get<string>(
      'SATUSEHAT_GLOBAL_CLIENT_ID',
    );
    const clientSecret = this.configService.get<string>(
      'SATUSEHAT_GLOBAL_CLIENT_SECRET',
    );

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Satu Sehat global OAuth credentials not configured',
      );
    }

    const authUrl = AUTH_URL[environment];
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
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
      const expiresAt = new Date(
        Date.now() + parseInt(data.expires_in || '3600') * 1000,
      );

      this.cachedTokens.set(environment, {
        token: data.access_token,
        expiresAt,
      });

      return data.access_token;
    } catch (err) {
      this.logger.error(`Token refresh failed: ${err.message}`);
      throw new ServiceUnavailableException(
        'Failed to get Satu Sehat access token',
      );
    }
  }
}

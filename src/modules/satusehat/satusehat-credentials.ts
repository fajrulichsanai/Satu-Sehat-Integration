import { Clinic } from '../clinics/entities/clinic.entity';
import { SatusehatEnvironment } from '../../enums/satusehat-environment.enum';

/**
 * Kredensial SATUSEHAT (Kode Akses API: Organization ID, Client ID, Client
 * Secret) dibaca dari env server:
 *
 *   SATUSEHAT_ENVIRONMENT=sandbox|production
 *   SATUSEHAT_ORGANIZATION_ID=...
 *   SATUSEHAT_CLIENT_ID=...
 *   SATUSEHAT_CLIENT_SECRET=...
 *
 * Klinik yang menyimpan kredensialnya sendiri di menu Konfigurasi (SaaS
 * multi-klinik) memakai miliknya; selain itu memakai env.
 */

/** Penanda: client secret diambil dari env, bukan kolom terenkripsi. */
export const ENV_SECRET_MARKER = '__env__';

export interface EnvCredentials {
  orgId: string;
  clientId: string;
  clientSecret: string;
  environment: SatusehatEnvironment;
}

export function envCredentials(): EnvCredentials | null {
  const orgId = process.env.SATUSEHAT_ORGANIZATION_ID?.trim();
  const clientId = process.env.SATUSEHAT_CLIENT_ID?.trim();
  const clientSecret = process.env.SATUSEHAT_CLIENT_SECRET?.trim();
  if (!orgId || !clientId || !clientSecret) return null;
  return {
    orgId,
    clientId,
    clientSecret,
    environment:
      process.env.SATUSEHAT_ENVIRONMENT?.trim() === 'production'
        ? SatusehatEnvironment.PRODUCTION
        : SatusehatEnvironment.SANDBOX,
  };
}

export function hasOwnCredentials(
  clinic: Pick<
    Clinic,
    'satusehatOrgId' | 'satusehatClientId' | 'satusehatClientSecret'
  >,
) {
  return !!(
    clinic.satusehatOrgId &&
    clinic.satusehatClientId &&
    clinic.satusehatClientSecret
  );
}

/** Sumber kredensial yang berlaku untuk klinik ini. */
export function credentialSource(clinic: Clinic): 'clinic' | 'env' | null {
  if (hasOwnCredentials(clinic)) return 'clinic';
  return envCredentials() ? 'env' : null;
}

/**
 * Klinik dengan kredensial efektif terisi (tidak disimpan ke DB). Bila
 * memakai env, client secret diganti penanda ENV_SECRET_MARKER.
 */
export function withEffectiveCredentials<T extends Clinic | null>(
  clinic: T,
): T {
  if (!clinic || hasOwnCredentials(clinic)) return clinic;
  const env = envCredentials();
  if (!env) return clinic;
  return Object.assign(clinic, {
    satusehatOrgId: env.orgId,
    satusehatClientId: env.clientId,
    satusehatClientSecret: ENV_SECRET_MARKER,
    satusehatEnvironment: env.environment,
  });
}

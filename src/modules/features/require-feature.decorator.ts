import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Tandai controller/endpoint milik sebuah fitur. Bila fitur itu dimatikan
 * untuk klinik atau user yang memanggil, permintaan ditolak (403).
 */
export const RequireFeature = (key: string) =>
  SetMetadata(REQUIRE_FEATURE_KEY, key);

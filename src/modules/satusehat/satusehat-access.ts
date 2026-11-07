import { ServiceUnavailableException } from '@nestjs/common';
import type { FeaturesService } from '../features/features.service';

/** Kunci fitur: opt-in, dinyalakan super admin per faskes. */
export const SATUSEHAT_FEATURE = 'satusehat';

export const SATUSEHAT_DISABLED_MESSAGE =
  'Integrasi SATUSEHAT belum diaktifkan untuk klinik ini — hubungi admin ApexRecord.';

/**
 * Pintu semua panggilan keluar ke SATUSEHAT atas nama satu klinik. Selama
 * super admin belum menyalakannya untuk faskes itu, berhenti sebelum ada
 * panggilan jaringan, token, atau pengiriman.
 */
export async function assertSatusehatEnabled(
  features: Pick<FeaturesService, 'isClinicFeatureOn'>,
  clinicId: number,
): Promise<void> {
  if (await features.isClinicFeatureOn(clinicId, SATUSEHAT_FEATURE)) return;
  throw new ServiceUnavailableException({
    success: false,
    error: { code: 'SATUSEHAT_DISABLED', message: SATUSEHAT_DISABLED_MESSAGE },
  });
}

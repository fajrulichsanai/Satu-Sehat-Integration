import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Saklar integrasi SATUSEHAT untuk seluruh platform.
 *
 * Nyala hanya bila env `SATUSEHAT_ENABLED=true`. Mati secara bawaan: selama
 * pengajuan akses SATUSEHAT belum disetujui, tidak ada panggilan keluar ke
 * SATUSEHAT, tidak ada pengiriman otomatis di latar belakang, dan fitur
 * SATUSEHAT disembunyikan dari pengguna. Fitur lain (pasien, kunjungan,
 * resep, billing, laporan) berjalan seperti biasa.
 */
export function satusehatPlatformEnabled(): boolean {
  return process.env.SATUSEHAT_ENABLED?.trim().toLowerCase() === 'true';
}

export const SATUSEHAT_DISABLED_MESSAGE =
  'Integrasi SATUSEHAT belum diaktifkan — masih dalam proses pengajuan akses.';

/** Dipanggil di setiap pintu keluar ke SATUSEHAT: berhenti sebelum ada I/O. */
export function assertSatusehatEnabled(): void {
  if (satusehatPlatformEnabled()) return;
  throw new ServiceUnavailableException({
    success: false,
    error: { code: 'SATUSEHAT_DISABLED', message: SATUSEHAT_DISABLED_MESSAGE },
  });
}

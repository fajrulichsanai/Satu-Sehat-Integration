import { BadRequestException } from '@nestjs/common';

/** Batas unggah foto selfie (dikompres di browser, biasanya < 150 KB) */
export const SELFIE_MAX_BYTES = 3 * 1024 * 1024;
const SELFIE_MIN_BYTES = 2 * 1024;

const SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: 'image/jpeg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    test: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    test: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/**
 * Selfie hanya pencegah titip absen: pastikan yang dikirim memang gambar
 * (dicek dari isi berkas, bukan nama atau tipe yang diklaim), lalu dibuang.
 * Berkas ada di memori saja — tidak pernah ditulis ke disk, storage, atau log.
 */
export function assertSelfie(file: Express.Multer.File | undefined): void {
  const fail = (message: string) =>
    new BadRequestException({
      success: false,
      error: { code: 'SELFIE_REQUIRED', message },
    });
  if (!file?.buffer) throw fail('Ambil foto selfie dulu sebelum absen');
  if (file.buffer.length < SELFIE_MIN_BYTES) {
    throw fail('Foto selfie tidak terbaca. Ambil ulang foto Anda');
  }
  if (!SIGNATURES.some((s) => s.test(file.buffer))) {
    throw fail('Foto selfie harus berupa gambar JPG, PNG, atau WEBP');
  }
}

/**
 * Satuan desimal seperti penjual storage: 1 GB = 1000 MB, sehingga paket
 * 0,1 GB tampil tepat 100 MB.
 */
export const GB = 1000 ** 3;
export const MB = 1000 ** 2;

/** Peringatan "hampir penuh" dan tombol "Tambah storage" mulai dari sini (PRD: 90%). */
export const STORAGE_WARN_RATIO = 0.9;

/** Batas satu kali pembelian storage tambahan. */
export const MAX_ADDON_GB_PER_PURCHASE = 100;

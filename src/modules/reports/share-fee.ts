import { FeeType } from '../doctor-fee/entities/doctor-fee-config.entity';

/**
 * Kolom share-fee per (dokter, tarif). Dasar fee persen = (harga satuan di
 * tagihan - biaya lab) x qty, memakai snapshot biaya lab di billing item
 * (fallback ke tarif untuk data lama). Konfigurasi fee nonaktif diabaikan.
 */
export const SHARE_FEE_SELECT = `
         SUM(bi.quantity) AS count,
         SUM(bi.quantity * bi.unit_price) AS totalHarga,
         SUM(bi.quantity * COALESCE(bi.biaya_lab, t.biaya_lab, 0)) AS totalBiayaLab,
         SUM(bi.quantity * GREATEST(bi.unit_price - COALESCE(bi.biaya_lab, t.biaya_lab, 0), 0)) AS dasarFee,
         SUM(bi.quantity * COALESCE(bi.harga_pokok, t.harga_pokok, 0)) AS totalModal,
         dfc.fee_type AS feeType,
         dfc.fee_value AS feeValue`;

export const SHARE_FEE_JOIN = `
       LEFT JOIN doctor_fee_configs dfc
         ON dfc.tarif_id = t.id AND dfc.clinic_id = b.clinic_id AND dfc.is_active = 1`;

export function computeShareFee(row: any) {
  const count = parseInt(row.count, 10) || 0;
  const hargaJual = parseFloat(row.hargaJual || 0);
  const totalHarga =
    row.totalHarga != null ? parseFloat(row.totalHarga) : hargaJual * count;
  const totalBiayaLab = parseFloat(row.totalBiayaLab || 0);
  const dasarFee =
    row.dasarFee != null
      ? parseFloat(row.dasarFee)
      : Math.max(totalHarga - totalBiayaLab, 0);
  const feeType: FeeType = row.feeType || FeeType.PERCENTAGE;
  const feeValue = parseFloat(row.feeValue || 0);
  const totalShare =
    feeType === FeeType.FIXED ? count * feeValue : dasarFee * (feeValue / 100);
  return {
    count,
    totalHarga,
    totalBiayaLab,
    dasarFee,
    feeType,
    feeValue,
    totalShare,
  };
}

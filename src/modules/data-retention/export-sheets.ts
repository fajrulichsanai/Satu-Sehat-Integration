/**
 * Isi ekspor data klinik: satu sheet per tabel, dengan nama yang mudah
 * dibaca. `scope` menjelaskan cara menemukan baris milik klinik:
 * - clinic: kolom clinic_id
 * - via: tabel anak tanpa clinic_id, lewat kolom FK ke tabel induk yang
 *   punya clinic_id (kunjungan, pasien, tagihan, ...)
 */
export interface SheetSpec {
  table: string;
  title: string;
  scope:
    | { kind: 'self' }
    | { kind: 'clinic' }
    | { kind: 'via'; column: string; parent: string; parentScope?: string };
}

export const EXPORT_SHEETS: SheetSpec[] = [
  { table: 'clinics', title: 'Klinik', scope: { kind: 'self' } },
  { table: 'users', title: 'Pengguna', scope: { kind: 'clinic' } },
  {
    table: 'practitioners',
    title: 'Tenaga Kesehatan',
    scope: { kind: 'clinic' },
  },
  { table: 'locations', title: 'Ruangan', scope: { kind: 'clinic' } },
  { table: 'patients', title: 'Pasien', scope: { kind: 'clinic' } },
  { table: 'reservations', title: 'Reservasi', scope: { kind: 'clinic' } },
  { table: 'encounters', title: 'Kunjungan', scope: { kind: 'clinic' } },
  {
    table: 'encounter_soap_notes',
    title: 'Catatan SOAP',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  {
    table: 'physical_examinations',
    title: 'Pemeriksaan Fisik',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  {
    table: 'dental_examinations',
    title: 'Pemeriksaan Gigi',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  {
    table: 'tooth_conditions',
    title: 'Odontogram',
    scope: { kind: 'via', column: 'patient_id', parent: 'patients' },
  },
  {
    table: 'dental_bridges',
    title: 'Jembatan Gigi',
    scope: { kind: 'via', column: 'patient_id', parent: 'patients' },
  },
  {
    table: 'supporting_exam_images',
    title: 'Foto Penunjang',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  {
    table: 'lab_orders',
    title: 'Order Lab',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  {
    table: 'lab_results',
    title: 'Hasil Lab',
    scope: {
      kind: 'via',
      column: 'order_id',
      parent: 'lab_orders',
      parentScope:
        'encounter_id IN (SELECT id FROM encounters WHERE clinic_id = ?)',
    },
  },
  {
    table: 'radiology_orders',
    title: 'Radiologi',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  {
    table: 'prescription_items',
    title: 'Resep',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  {
    table: 'prescription_reviews',
    title: 'Pengkajian Resep',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  {
    table: 'prescription_signatures',
    title: 'TTD Resep',
    scope: { kind: 'via', column: 'encounter_id', parent: 'encounters' },
  },
  { table: 'immunizations', title: 'Imunisasi', scope: { kind: 'clinic' } },
  { table: 'referrals', title: 'Rujukan', scope: { kind: 'clinic' } },
  {
    table: 'patient_consents',
    title: 'Persetujuan Tindakan',
    scope: { kind: 'clinic' },
  },
  {
    table: 'treatment_plans',
    title: 'Rencana Perawatan',
    scope: { kind: 'clinic' },
  },
  {
    table: 'treatment_plan_sessions',
    title: 'Sesi Perawatan',
    scope: {
      kind: 'via',
      column: 'treatment_plan_id',
      parent: 'treatment_plans',
    },
  },
  {
    table: 'patient_recalls',
    title: 'Recall Pasien',
    scope: { kind: 'clinic' },
  },
  { table: 'billings', title: 'Tagihan', scope: { kind: 'clinic' } },
  {
    table: 'billing_items',
    title: 'Item Tagihan',
    scope: { kind: 'via', column: 'billing_id', parent: 'billings' },
  },
  {
    table: 'payments',
    title: 'Pembayaran Pasien',
    scope: { kind: 'via', column: 'billing_id', parent: 'billings' },
  },
  { table: 'tarifs', title: 'Tarif', scope: { kind: 'clinic' } },
  {
    table: 'recall_intervals',
    title: 'Interval Recall',
    scope: { kind: 'clinic' },
  },
  {
    table: 'doctor_fee_configs',
    title: 'Jasa Dokter',
    scope: { kind: 'clinic' },
  },
  {
    table: 'consent_templates',
    title: 'Template Persetujuan',
    scope: { kind: 'clinic' },
  },
  {
    table: 'soap_templates',
    title: 'Template SOAP',
    scope: { kind: 'clinic' },
  },
  { table: 'barang', title: 'Barang', scope: { kind: 'clinic' } },
  {
    table: 'stok_transaksi',
    title: 'Transaksi Stok',
    scope: { kind: 'clinic' },
  },
  {
    table: 'tindakan_bom',
    title: 'Bahan per Tindakan',
    scope: { kind: 'clinic' },
  },
  {
    table: 'operational_records',
    title: 'Biaya Operasional',
    scope: { kind: 'clinic' },
  },
  { table: 'attendance_records', title: 'Absensi', scope: { kind: 'clinic' } },
  { table: 'work_schedules', title: 'Jadwal Kerja', scope: { kind: 'clinic' } },
  { table: 'clinic_contents', title: 'Konten', scope: { kind: 'clinic' } },
  {
    table: 'clinic_subscriptions',
    title: 'Riwayat Langganan',
    scope: { kind: 'clinic' },
  },
  {
    table: 'subscription_payments',
    title: 'Pembayaran Langganan',
    scope: { kind: 'clinic' },
  },
  { table: 'audit_logs', title: 'Log Aktivitas', scope: { kind: 'clinic' } },
];

/** Kolom rahasia/teknis yang tidak pernah ikut diekspor. */
export const OMIT_COLUMNS = new Set([
  'clinic_id',
  'password_hash',
  'mfa_secret',
  'mfa_backup_codes',
  'verification_token',
  'reset_password_token',
  'reset_password_expires_at',
  'token_version',
  'failed_login_attempts',
  'locked_until',
  'nik_hash',
  'satusehat_client_secret',
  'satusehat_token',
  'satusehat_token_expires_at',
  'key_hash',
  'token',
  'token_hash',
  'proof_url',
]);

/** Judul kolom yang umum; sisanya dibuat dari nama kolom. */
export const HEADER_LABELS: Record<string, string> = {
  id: 'ID',
  created_at: 'Dibuat',
  updated_at: 'Diubah',
  created_by: 'Dibuat oleh',
  updated_by: 'Diubah oleh',
  name: 'Nama',
  no_rm: 'No. RM',
  nik: 'NIK',
  birth_date: 'Tanggal lahir',
  gender: 'Jenis kelamin',
  phone: 'Telepon',
  email: 'Email',
  address: 'Alamat',
  city: 'Kota',
  province: 'Provinsi',
  postal_code: 'Kode pos',
  status: 'Status',
  notes: 'Catatan',
  note: 'Catatan',
  patient_id: 'Pasien',
  practitioner_id: 'Dokter',
  encounter_id: 'ID kunjungan',
  user_id: 'Pengguna',
  tarif_id: 'Tarif',
  billing_id: 'ID tagihan',
  quantity: 'Jumlah',
  amount: 'Nominal',
  role: 'Peran',
  is_active: 'Aktif',
  service_type: 'Jenis layanan',
  chief_complaint: 'Keluhan utama',
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
  diagnoses: 'Diagnosis',
  invoice_number: 'No. invoice',
  grand_total: 'Total',
  paid_amount: 'Dibayar',
  outstanding_amount: 'Sisa',
  method: 'Metode',
  paid_at: 'Dibayar pada',
  harga_jual: 'Harga jual',
  harga_pokok: 'Harga pokok',
  start_date: 'Mulai',
  end_date: 'Berakhir',
  file_url: 'Berkas',
  original_name: 'Nama berkas asli',
  actor_name: 'Pelaku',
  action_type: 'Aksi',
  entity_type: 'Data',
  entity_label: 'Keterangan',
};

/** Kolom ID yang diganti nama yang mudah dibaca. */
export const LOOKUP_COLUMNS: Record<
  string,
  'patients' | 'practitioners' | 'users' | 'tarifs'
> = {
  patient_id: 'patients',
  referrer_patient_id: 'patients',
  practitioner_id: 'practitioners',
  user_id: 'users',
  created_by: 'users',
  updated_by: 'users',
  actor_id: 'users',
  confirmed_by: 'users',
  dispensed_by: 'users',
  administered_by: 'users',
  reviewed_by: 'users',
  contacted_by: 'users',
  corrected_by: 'users',
  tarif_id: 'tarifs',
};

export function humanizeColumn(column: string): string {
  if (HEADER_LABELS[column]) return HEADER_LABELS[column];
  const words = column.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

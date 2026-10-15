import { UserRole } from '../../enums/user-role.enum';

/**
 * Fitur standar aplikasi (sama dengan FeatureKey di frontend).
 * `toggleable` = boleh dimatikan per klinik (super admin) / per user (owner).
 * Fitur inti pengelolaan klinik (user, info klinik, langganan, …) tidak
 * bisa dimatikan supaya owner tidak terkunci dari kliniknya sendiri.
 */
export const STANDARD_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', toggleable: true },
  { key: 'pasien', label: 'Pasien', toggleable: true },
  { key: 'reservasi', label: 'Reservasi', toggleable: true },
  { key: 'kunjungan', label: 'Kunjungan & Rekam Medis', toggleable: true },
  { key: 'farmasi', label: 'Farmasi', toggleable: true },
  { key: 'billing', label: 'Transaksi / Billing', toggleable: true },
  { key: 'operasional', label: 'Operasional', toggleable: true },
  { key: 'share-fee-dokter', label: 'Share Fee Dokter', toggleable: true },
  { key: 'share-fee-saya', label: 'Share Fee Saya', toggleable: true },
  { key: 'recall-reminder', label: 'Recall & Reminder', toggleable: true },
  { key: 'informed-consent', label: 'Informed Consent', toggleable: true },
  { key: 'gudang', label: 'Gudang / Stok', toggleable: true },
  { key: 'laporan-kunjungan', label: 'Laporan Kunjungan', toggleable: true },
  { key: 'laporan-keuangan', label: 'Laporan Keuangan', toggleable: true },
  {
    key: 'laporan-keuangan-pro',
    label: 'Laporan Keuangan Pro',
    toggleable: true,
  },
  { key: 'tarif', label: 'Tarif', toggleable: true },
  { key: 'referral', label: 'Referral', toggleable: true },
  { key: 'audit-log', label: 'Log Aktivitas', toggleable: true },
  { key: 'api', label: 'API Klinik', toggleable: true },
  { key: 'konten', label: 'Konten', toggleable: true },
  { key: 'satusehat', label: 'SATUSEHAT', toggleable: true },
  { key: 'imunisasi', label: 'Imunisasi / Vaksin', toggleable: true },
  { key: 'absensi', label: 'Absensi Pegawai', toggleable: true },
  { key: 'info-klinik', label: 'Info Klinik', toggleable: false },
  { key: 'user-management', label: 'Manajemen User', toggleable: false },
  { key: 'langganan', label: 'Langganan', toggleable: false },
  { key: 'onboarding', label: 'Onboarding', toggleable: false },
  { key: 'tampilan', label: 'Tampilan', toggleable: false },
  { key: 'data-privasi', label: 'Data & Privasi', toggleable: false },
] as const;

export type StandardFeatureKey = (typeof STANDARD_FEATURES)[number]['key'];

export const TOGGLEABLE_FEATURES: string[] = STANDARD_FEATURES.filter(
  (f) => f.toggleable,
).map((f) => f.key);

export const STANDARD_FEATURE_KEYS: string[] = STANDARD_FEATURES.map(
  (f) => f.key,
);

/**
 * Fitur opt-in: mati sampai super admin menyalakannya untuk klinik
 * (mis. imunisasi — hanya klinik yang memberi vaksin).
 */
export const OPT_IN_FEATURES = new Set<string>(['imunisasi']);

/**
 * SATUSEHAT: selain saklar per klinik, butuh saklar global platform
 * (lihat PlatformSettingsService). Owner klinik boleh mematikannya sendiri.
 */
export const SATUSEHAT_FEATURE = 'satusehat';

const FULL_ACCESS: string[] = [
  'dashboard',
  'pasien',
  'reservasi',
  'kunjungan',
  'farmasi',
  'billing',
  'operasional',
  'share-fee-dokter',
  'recall-reminder',
  'informed-consent',
  'gudang',
  'laporan-kunjungan',
  'laporan-keuangan',
  'laporan-keuangan-pro',
  'info-klinik',
  'tarif',
  'user-management',
  'referral',
  'audit-log',
  'langganan',
  'tampilan',
  'api',
  'konten',
  'satusehat',
  'imunisasi',
  'absensi',
];

const CLINICIAN = [
  'pasien',
  'reservasi',
  'kunjungan',
  'farmasi',
  'informed-consent',
  'share-fee-saya',
  'tampilan',
  'imunisasi',
  'absensi',
];

/** Fitur bawaan tiap role (cerminan lib/permissions.ts di frontend) */
export const ROLE_DEFAULT_FEATURES: Record<UserRole, string[]> = {
  [UserRole.SUPER_ADMIN]: ['api', 'user-management', 'tampilan'],
  [UserRole.MULTI_CLINIC_OWNER]: ['tampilan'],
  [UserRole.OWNER]: [...FULL_ACCESS, 'onboarding', 'data-privasi'],
  // Manajer Cabang acts with the owner's rights (see JwtStrategy).
  [UserRole.MANAJER_CABANG]: [...FULL_ACCESS, 'onboarding', 'data-privasi'],
  [UserRole.ADMIN]: [
    'pasien',
    'reservasi',
    'kunjungan',
    'farmasi',
    'billing',
    'operasional',
    'recall-reminder',
    'informed-consent',
    'gudang',
    'laporan-kunjungan',
    'info-klinik',
    'tarif',
    'referral',
    'langganan',
    'konten',
    'tampilan',
    'satusehat',
    'absensi',
  ],
  [UserRole.DOKTER]: CLINICIAN,
  [UserRole.PERAWAT]: CLINICIAN,
  [UserRole.PENDING]: ['tampilan'],
};

/** Role yang fiturnya diatur lewat klinik (bukan super admin / multi-klinik / pending) */
export const CLINIC_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.DOKTER,
  UserRole.PERAWAT,
];

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import {
  Gender,
  SyncStatus,
  MaritalStatus,
  BloodType,
  Rhesus,
  HubunganWali,
  SumberInformasi,
  PreferensiKontak,
  PreferensiJamKontak,
} from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('patients')
@Index(['noRm', 'clinicId'], { unique: true })
@Index(['nik', 'clinicId'], { unique: true })
export class Patient extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'no_rm', length: 20 })
  noRm: string;

  @Column({ length: 16, nullable: true })
  nik: string;

  @Column({ name: 'nik_ibu', length: 16, nullable: true })
  nikIbu: string;

  @Column({ name: 'nama_wali', length: 100, nullable: true })
  namaWali: string;

  @Column({
    name: 'hubungan_wali',
    type: 'enum',
    enum: HubunganWali,
    nullable: true,
  })
  hubunganWali: HubunganWali;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date;

  @Column({ name: 'birth_order', nullable: true })
  birthOrder: number;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ length: 100, nullable: true })
  pekerjaan: string;

  @Column('text', { nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  kelurahan: string;

  @Column({ length: 100, nullable: true })
  kecamatan: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 100, nullable: true })
  province: string;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string;

  @Column({
    name: 'marital_status',
    type: 'enum',
    enum: MaritalStatus,
    nullable: true,
  })
  maritalStatus: MaritalStatus;

  @Column({ name: 'ihs_number', length: 50, nullable: true })
  ihsNumber: string;

  @Column({ name: 'satusehat_patient_id', length: 100, nullable: true })
  satusehatPatientId: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  @Column('text', { name: 'sync_error', nullable: true })
  syncError: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;

  // Akuisisi & Marketing
  @Column({
    name: 'sumber_informasi',
    type: 'enum',
    enum: SumberInformasi,
    nullable: true,
  })
  sumberInformasi: SumberInformasi;

  @Column({ name: 'detail_sumber', length: 200, nullable: true })
  detailSumber: string;

  @Column({ name: 'kode_referral', length: 50, nullable: true })
  kodeReferral: string;

  @Column({ name: 'referrer_patient_id', nullable: true })
  referrerPatientId: number;

  // Riwayat Medis Singkat
  @Column({
    name: 'golongan_darah',
    type: 'enum',
    enum: BloodType,
    nullable: true,
  })
  golonganDarah: BloodType;

  @Column({
    type: 'enum',
    enum: Rhesus,
    nullable: true,
  })
  rhesus: Rhesus;

  @Column({ name: 'punya_alergi', default: false })
  punyaAlergi: boolean;

  @Column('text', { name: 'catatan_alergi', nullable: true })
  catatanAlergi: string;

  @Column({ name: 'riwayat_hipertensi', default: false })
  riwayatHipertensi: boolean;

  @Column({ name: 'riwayat_diabetes', default: false })
  riwayatDiabetes: boolean;

  @Column({ name: 'riwayat_paru_paru', default: false })
  riwayatParuParu: boolean;

  @Column({ name: 'riwayat_syaraf', default: false })
  riwayatSyaraf: boolean;

  @Column({ name: 'riwayat_sistemik_lainnya', default: false })
  riwayatSistemikLainnya: boolean;

  @Column({ name: 'alergi_obat', default: false })
  alergiObat: boolean;

  @Column({ name: 'alergi_makanan', default: false })
  alergiMakanan: boolean;

  // Preferensi & Membership
  @Column({
    name: 'preferensi_kontak',
    type: 'enum',
    enum: PreferensiKontak,
    nullable: true,
  })
  preferensiKontak: PreferensiKontak;

  @Column({
    name: 'preferensi_jam_kontak',
    type: 'enum',
    enum: PreferensiJamKontak,
    nullable: true,
  })
  preferensiJamKontak: PreferensiJamKontak;

  @Column('text', { name: 'catatan_preferensi', nullable: true })
  catatanPreferensi: string;

  @Column({ name: 'is_member', default: false })
  isMember: boolean;

  @Column({ name: 'member_id', length: 50, nullable: true })
  memberId: string;

  // Persetujuan
  @Column({ name: 'consent_marketing', default: false })
  consentMarketing: boolean;

  @Column({ name: 'consent_tanggal', nullable: true })
  consentTanggal: Date;

  @Column({ name: 'consent_version', length: 20, nullable: true })
  consentVersion: string;

  @Column({ name: 'status_aktif', default: true })
  statusAktif: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}

import { Entity, Column, OneToMany } from 'typeorm';
import { SatusehatEnvironment } from '../../../enums/satusehat-environment.enum';
import { BaseEntity } from '../../../common/base.entity';

@Entity('clinics')
export class Clinic extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column('text')
  address: string;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 100 })
  province: string;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ length: 255, nullable: true })
  website: string;

  @Column({ name: 'sip_number', length: 50, nullable: true })
  sipNumber: string;

  @Column({ name: 'operational_hours', type: 'json', nullable: true })
  operationalHours: Record<string, any>;

  @Column({ name: 'setup_complete', default: false })
  setupComplete: boolean;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  // ── Integrasi SATUSEHAT (Kemenkes) ─────────────────────────────────────
  // Client secret disimpan terenkripsi (crypto.util); token di-cache di sini.

  @Column({ name: 'satusehat_org_id', type: 'varchar', length: 100, nullable: true })
  satusehatOrgId: string | null;

  @Column({ name: 'satusehat_client_id', type: 'varchar', length: 255, nullable: true })
  satusehatClientId: string | null;

  @Column({ name: 'satusehat_client_secret', type: 'varchar', length: 512, nullable: true })
  satusehatClientSecret: string | null;

  @Column({
    name: 'satusehat_environment',
    type: 'enum',
    enum: SatusehatEnvironment,
    default: SatusehatEnvironment.SANDBOX,
  })
  satusehatEnvironment: SatusehatEnvironment;

  @Column({ name: 'satusehat_token', type: 'text', nullable: true })
  satusehatToken: string | null;

  @Column({ name: 'satusehat_token_expires_at', type: 'datetime', nullable: true })
  satusehatTokenExpiresAt: Date | null;

  /** Nama Organization induk di SATUSEHAT (hasil verifikasi) */
  @Column({ name: 'satusehat_org_name', type: 'varchar', length: 255, nullable: true })
  satusehatOrgName: string | null;

  /** Struktur organisasi (Postman "00. Membuat Struktur Organisasi dan Lokasi") */
  @Column({ name: 'satusehat_suborg_id', type: 'varchar', length: 100, nullable: true })
  satusehatSuborgId: string | null;

  @Column({ name: 'satusehat_poli_org_id', type: 'varchar', length: 100, nullable: true })
  satusehatPoliOrgId: string | null;

  @Column({ name: 'satusehat_pharmacy_org_id', type: 'varchar', length: 100, nullable: true })
  satusehatPharmacyOrgId: string | null;

  /** Location "Poli Gigi" default bila kunjungan tidak punya ruangan */
  @Column({ name: 'satusehat_poli_location_id', type: 'varchar', length: 100, nullable: true })
  satusehatPoliLocationId: string | null;
}

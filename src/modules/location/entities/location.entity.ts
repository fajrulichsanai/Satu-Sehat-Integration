import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import type { SatusehatAddress } from '../../satusehat/onboarding/address';

@Entity('locations')
export class Location extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  type: string; // HOSP, ROOM, DEPT

  @Column({ name: 'satusehat_location_id', length: 100, nullable: true })
  satusehatLocationId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // ── Data registrasi Location SATUSEHAT (Template Registrasi Organization & Location) ──

  /** Kode/nomor internal (Location.identifier.value) */
  @Column({ name: 'ss_code', type: 'varchar', length: 50, nullable: true })
  ssCode: string | null;

  @Column({
    name: 'ss_description',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ssDescription: string | null;

  /** location-physical-type: si | bu | wi | lvl | wa | ro | area */
  @Column({
    name: 'ss_physical_type',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  ssPhysicalType: string | null;

  /** Lokasi induk (Location.partOf), mis. ruang → gedung */
  @Column({ name: 'ss_parent_location_id', type: 'int', nullable: true })
  ssParentLocationId: number | null;

  /** Organisasi pengelola (satusehat_organizations.id); null = organisasi induk */
  @Column({ name: 'ss_organization_id', type: 'int', nullable: true })
  ssOrganizationId: number | null;

  @Column({ name: 'ss_phone', type: 'varchar', length: 30, nullable: true })
  ssPhone: string | null;

  @Column({ name: 'ss_address', type: 'json', nullable: true })
  ssAddress: SatusehatAddress | null;

  @Column({
    name: 'ss_latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  ssLatitude: string | null;

  @Column({
    name: 'ss_longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  ssLongitude: string | null;

  /** Jam operasional: hari (mon..sun) + jam buka/tutup */
  @Column({ name: 'ss_hours', type: 'json', nullable: true })
  ssHours: {
    days: string[];
    allDay?: boolean;
    opening?: string | null;
    closing?: string | null;
  } | null;

  @Column({
    name: 'ss_sync_error',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  ssSyncError: string | null;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}

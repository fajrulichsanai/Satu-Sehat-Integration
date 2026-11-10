import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../../common/base.entity';
import { Clinic } from '../../../clinics/entities/clinic.entity';
import type { SatusehatAddress } from '../address';

/**
 * Sub-organisasi fasyankes yang didaftarkan ke SATUSEHAT (Organization,
 * partOf organisasi induk atau sub-organisasi lain) — kolom mengikuti
 * "Template Registrasi Organization & Location" resmi.
 */
@Entity('satusehat_organizations')
@Index(['clinicId'])
export class SatusehatOrganization extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  /** null = langsung di bawah organisasi induk (Organization ID fasyankes) */
  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  /** Kode/nomor internal (Organization.identifier.value) */
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** organization-type: prov | dept | team | other */
  @Column({ type: 'varchar', length: 20, default: 'dept' })
  type: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  website: string | null;

  @Column({ type: 'json', nullable: true })
  address: SatusehatAddress | null;

  @Column({
    name: 'contact_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  contactName: string | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  contactPhone: string | null;

  /** contactentity-type: ADMIN | BILL | HR | PAYOR | PATINF | PRESS */
  @Column({
    name: 'contact_purpose',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  contactPurpose: string | null;

  @Column({
    name: 'satusehat_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  satusehatId: string | null;

  @Column({ name: 'sync_error', type: 'varchar', length: 500, nullable: true })
  syncError: string | null;

  @Column({ name: 'last_sync_at', type: 'datetime', nullable: true })
  lastSyncAt: Date | null;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}

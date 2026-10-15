import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum OwnerClinicLinkStatus {
  /** Diajukan Super Admin, menunggu jawaban owner klinik. */
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  /** Tidak dijawab dalam LINK_REQUEST_TTL_DAYS hari. */
  EXPIRED = 'expired',
}

/** Siapa yang membayar langganan cabang ini mulai periode berikutnya. */
export enum BranchBillingMode {
  /** Ikut tagihan gabungan owner multiklinik. */
  OWNER = 'owner',
  /** Cabang membayar sendiri, tetap harga cabang Multi Klinik. */
  SELF = 'self',
  /** Owner berhenti menanggung; cabang berlangganan seperti klinik biasa. */
  STOPPED = 'stopped',
}

/** Permintaan hubungan yang tidak dijawab kedaluwarsa setelah ini (PRD PS-02). */
export const LINK_REQUEST_TTL_DAYS = 90;

/**
 * Hubungan satu akun MULTI_CLINIC_OWNER dengan satu klinik (cabang). Satu
 * klinik hanya boleh punya satu baris (unique clinic_id) — permintaan yang
 * ditolak/kedaluwarsa dipakai ulang saat Super Admin mengajukan lagi.
 * Hanya baris berstatus APPROVED yang memberi owner akses ke cabang.
 */
@Entity('owner_clinic_links')
@Index('UQ_owner_clinic_links_clinic', ['clinicId'], { unique: true })
export class OwnerClinicLink extends BaseEntity {
  @Column({ name: 'owner_id' })
  @Index('IDX_owner_clinic_links_owner_id')
  ownerId: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({
    type: 'varchar',
    length: 12,
    default: OwnerClinicLinkStatus.APPROVED,
  })
  status: OwnerClinicLinkStatus;

  @Column({ name: 'requested_at', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'requested_by', type: 'int', nullable: true })
  requestedBy: number | null;

  @Column({ name: 'responded_at', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'responded_by', type: 'int', nullable: true })
  respondedBy: number | null;

  @Column({
    name: 'billing_mode',
    type: 'varchar',
    length: 10,
    default: BranchBillingMode.OWNER,
  })
  billingMode: BranchBillingMode;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}

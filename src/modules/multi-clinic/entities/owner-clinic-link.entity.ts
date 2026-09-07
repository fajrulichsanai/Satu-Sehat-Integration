import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

/**
 * Menghubungkan satu akun MULTI_CLINIC_OWNER ke satu/banyak klinik yang
 * ia miliki (PRD — Role Multi-Klinik Owner). Dikelola oleh Super Admin.
 * Owner dengan role ini tidak terikat ke satu clinicId (mirip super_admin)
 * — dashboard cross-klinik-nya dibangun dari daftar link ini.
 */
@Entity('owner_clinic_links')
@Unique(['ownerId', 'clinicId'])
export class OwnerClinicLink extends BaseEntity {
  @Column({ name: 'owner_id' })
  ownerId: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}

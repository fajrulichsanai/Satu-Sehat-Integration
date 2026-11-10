import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface PractitionerChange {
  field: string;
  label: string;
  /** Nilai lama/baru; NIK selalu tersamar */
  from: string | null;
  to: string | null;
}

/** Riwayat revisi data tenaga kesehatan (siapa, kapan, apa, alasannya). */
@Entity('practitioner_revisions')
@Index(['clinicId', 'practitionerId'])
export class PractitionerRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'practitioner_id' })
  practitionerId: number;

  @Column({ name: 'changed_by', type: 'int', nullable: true })
  changedBy: number | null;

  @Column({
    name: 'changed_by_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  changedByName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'json' })
  changes: PractitionerChange[];
}

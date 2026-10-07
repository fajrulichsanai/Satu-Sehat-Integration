import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/**
 * Imunisasi/vaksin yang diberikan di kunjungan (FHIR Immunization).
 * Vaksin wajib berkode produk KFA (93…). Dihapus setelah terkirim →
 * status entered-in-error, dikirim sekali lalu barisnya dibuang.
 */
@Entity('immunizations')
@Index(['encounterId'])
@Index(['clinicId', 'patientId'])
export class Immunization extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'kfa_code', type: 'varchar', length: 20 })
  kfaCode: string;

  @Column({ name: 'vaccine_name', type: 'varchar', length: 255 })
  vaccineName: string;

  /** Dosis ke- */
  @Column({ name: 'dose_number', type: 'int' })
  doseNumber: number;

  @Column({
    name: 'dose_ml',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  doseMl: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  route: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  site: string | null;

  @Column({ name: 'lot_number', type: 'varchar', length: 50, nullable: true })
  lotNumber: string | null;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: string | null;

  @Column({ name: 'occurred_at', type: 'datetime' })
  occurredAt: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;

  /** completed | entered-in-error */
  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status: string;
}

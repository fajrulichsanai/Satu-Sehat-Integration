import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BillingItem } from '../../billing-item/entities/billing-item.entity';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Patient } from '../../patients/entities/patient.entity';

export enum BillingStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('billings')
@Index(['invoiceNumber'], { unique: true })
@Index(['clinicId'])
@Index(['encounterId'])
export class Billing extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'invoice_number', length: 50 })
  invoiceNumber: string;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', {
    name: 'total_discount',
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalDiscount: number;

  @Column('decimal', { name: 'grand_total', precision: 10, scale: 2 })
  grandTotal: number;

  @Column('decimal', {
    name: 'paid_amount',
    precision: 10,
    scale: 2,
    default: 0,
  })
  paidAmount: number;

  @Column('decimal', { name: 'outstanding_amount', precision: 10, scale: 2 })
  outstandingAmount: number;

  @Column({
    type: 'enum',
    enum: BillingStatus,
    default: BillingStatus.UNPAID,
  })
  status: BillingStatus;

  @Column('text', { nullable: true })
  notes: string;

  // Relations
  @OneToMany(() => BillingItem, (item) => item.billing)
  items: BillingItem[];

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Encounter, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;
}

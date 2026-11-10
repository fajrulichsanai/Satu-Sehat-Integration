import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

// BIGINT columns come back from mysql2 as strings; money here stays far
// below Number.MAX_SAFE_INTEGER.
const money: ValueTransformer = {
  to: (v?: number) => v,
  from: (v?: string | null) => (v === null || v === undefined ? 0 : Number(v)),
};

/** Gaji pokok & rekening per pegawai (diatur owner). */
@Entity('employee_salaries')
@Index(['clinicId', 'userId'], { unique: true })
export class EmployeeSalary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column('bigint', { name: 'base_salary', default: 0, transformer: money })
  baseSalary: number;

  @Column({ name: 'bank_name', type: 'varchar', length: 50, nullable: true })
  bankName: string | null;

  @Column({ name: 'bank_account', type: 'varchar', length: 50, nullable: true })
  bankAccount: string | null;

  @Column({ name: 'bank_holder', type: 'varchar', length: 100, nullable: true })
  bankHolder: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export type PayrollStatus = 'draft' | 'paid';

/** Satu periode penggajian (YYYY-MM) per klinik. */
@Entity('payroll_runs')
@Index(['clinicId', 'period'], { unique: true })
export class PayrollRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ type: 'char', length: 7 })
  period: string;

  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status: PayrollStatus;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'operational_record_id', type: 'int', nullable: true })
  operationalRecordId: number | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export interface PayrollAttendance {
  workDays: number;
  presentDays: number;
  lateCount: number;
  lateMinutes: number;
  absentDays: number;
}

/** Baris gaji per pegawai dalam satu periode — snapshot saat dibuat. */
@Entity('payroll_items')
@Index(['runId', 'userId'], { unique: true })
export class PayrollItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'run_id' })
  runId: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 30 })
  role: string;

  @Column('bigint', { name: 'base_salary', default: 0, transformer: money })
  baseSalary: number;

  @Column('bigint', { default: 0, transformer: money })
  bonus: number;

  @Column('bigint', { default: 0, transformer: money })
  deduction: number;

  @Column('bigint', { name: 'share_fee', default: 0, transformer: money })
  shareFee: number;

  @Column({ type: 'json', nullable: true })
  attendance: PayrollAttendance | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

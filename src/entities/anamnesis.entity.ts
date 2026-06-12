import { Entity, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Encounter } from './encounter.entity';

export enum BloodType {
  A = 'A',
  B = 'B',
  AB = 'AB',
  O = 'O',
}

export enum Rhesus {
  POSITIVE = '+',
  NEGATIVE = '-',
}

export enum PregnancyStatus {
  PREGNANT = 'pregnant',
  NOT_PREGNANT = 'not_pregnant',
}

@Entity('anamnesis')
export class Anamnesis extends BaseEntity {
  @Column({ name: 'encounter_id', unique: true })
  encounterId: number;

  @Column({ name: 'keluhan_utama', type: 'text' })
  keluhanUtama: string;

  @Column({ name: 'riwayat_penyakit', type: 'text', nullable: true })
  riwayatPenyakit: string;

  @Column({ name: 'golongan_darah', type: 'enum', enum: BloodType, nullable: true })
  golonganDarah: BloodType;

  @Column({ type: 'enum', enum: Rhesus, nullable: true })
  rhesus: Rhesus;

  @Column({ name: 'status_kehamilan', type: 'enum', enum: PregnancyStatus, nullable: true })
  statusKehamilan: PregnancyStatus;

  @OneToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}

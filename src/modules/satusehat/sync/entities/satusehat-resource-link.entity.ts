import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/base.entity';

/**
 * Pemetaan data lokal → resource SATUSEHAT yang sudah dibuat.
 *
 * Dipakai untuk data yang tidak punya kolom satusehat_*_id sendiri
 * (tanda vital, anamnesis, OHIS, Medication untuk resep/pengeluaran,
 * MedicationDispense). Bila link sudah ada, pengiriman ulang memakai PUT
 * sehingga tidak membuat resource ganda di SATUSEHAT.
 */
@Entity('satusehat_resource_links')
@Index(['clinicId', 'localType', 'localId'], { unique: true })
export class SatusehatResourceLink extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  /** mis. vital_sign, anamnesis_blood_type, ohis_total, rx_medication, dispense */
  @Column({ name: 'local_type', length: 50 })
  localType: string;

  @Column({ name: 'local_id' })
  localId: number;

  @Column({ name: 'resource_type', length: 50 })
  resourceType: string;

  @Column({ name: 'satusehat_id', length: 100 })
  satusehatId: string;
}

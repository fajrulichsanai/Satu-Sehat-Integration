import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * Baris di sini = folder bawaan sistem (`photo_template_groups.clinicId`
 * null) itu dinonaktifkan untuk `clinicId` ini saja — klinik lain tidak
 * terpengaruh. Klinik tidak bisa menghapus folder bawaan, hanya menonaktifkan.
 */
@Entity('clinic_disabled_photo_groups')
export class ClinicDisabledPhotoGroup {
  @PrimaryColumn({ name: 'clinic_id' })
  clinicId: number;

  @PrimaryColumn({ name: 'group_id' })
  groupId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

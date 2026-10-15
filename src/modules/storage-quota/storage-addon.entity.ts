import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum StorageAddonSource {
  /** Dibeli owner dari halaman Langganan; ditagih di perpanjangan berikutnya. */
  PURCHASE = 'purchase',
  /** Ditambah/dikurangi Super Admin secara manual. */
  ADMIN = 'admin',
}

/**
 * Satu perubahan storage tambahan (GB, bisa negatif untuk pengurangan oleh
 * Super Admin). Untuk klinik biasa diisi clinicId; untuk jatah bersama
 * multiklinik diisi ownerId. Jumlah gb = storage tambahan yang berlaku.
 */
@Entity('storage_addons')
export class StorageAddon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id', type: 'int', nullable: true })
  @Index('IDX_storage_addons_clinic')
  clinicId: number | null;

  @Column({ name: 'owner_id', type: 'int', nullable: true })
  @Index('IDX_storage_addons_owner')
  ownerId: number | null;

  @Column({ type: 'int' })
  gb: number;

  @Column({ type: 'varchar', length: 10 })
  source: StorageAddonSource;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  ValueTransformer,
} from 'typeorm';

const num: ValueTransformer = {
  to: (v?: number) => v,
  from: (v?: string | null) => (v === null || v === undefined ? 0 : Number(v)),
};

/** Satu sesi stock opname (hitung fisik BMHP) — riwayat tidak bisa diubah. */
@Entity('stock_opnames')
@Index(['clinicId'])
export class StockOpname {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ type: 'date' })
  tanggal: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  /** Σ selisih × harga beli; negatif = barang hilang/rusak. */
  @Column('bigint', {
    name: 'total_selisih_nilai',
    default: 0,
    transformer: num,
  })
  totalSelisihNilai: number;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @Column({
    name: 'created_by_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  createdByName: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('stock_opname_items')
@Index(['opnameId'])
export class StockOpnameItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'opname_id' })
  opnameId: number;

  @Column({ name: 'barang_id' })
  barangId: number;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'stok_sistem', type: 'int' })
  stokSistem: number;

  @Column({ name: 'stok_fisik', type: 'int' })
  stokFisik: number;

  @Column({ type: 'int' })
  selisih: number;

  @Column('decimal', {
    name: 'harga_beli',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: num,
  })
  hargaBeli: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  catatan: string | null;
}

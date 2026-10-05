import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Salinan lokal katalog obat KFA SATUSEHAT (product_type=farmasi), diisi
 * oleh sinkronisasi bertahap (KfaService.syncCatalog). Pencarian obat di
 * form resep memakai tabel ini bila sudah terisi — lebih cepat dan tetap
 * jalan saat API KFA lambat/terputus.
 */
@Entity('kfa_products')
@Index('IDX_kfa_products_name', ['name'])
export class KfaProductEntity {
  @PrimaryColumn({ name: 'kfa_code', type: 'varchar', length: 20 })
  kfaCode: string;

  @Column({ type: 'varchar', length: 512 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({
    name: 'product_group',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  group: string | null;

  @Column({
    name: 'dosage_form_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  dosageFormCode: string | null;

  @Column({
    name: 'dosage_form_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  dosageFormName: string | null;

  @Column({ name: 'route_code', type: 'varchar', length: 20, nullable: true })
  routeCode: string | null;

  @Column({ name: 'route_name', type: 'varchar', length: 255, nullable: true })
  routeName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  uom: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  manufacturer: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nie: string | null;

  @Column({ type: 'boolean', nullable: true })
  generic: boolean | null;

  @Column({
    name: 'template_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  templateCode: string | null;

  @Column({
    name: 'template_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  templateName: string | null;

  @Column({ name: 'active_ingredients', type: 'json', nullable: true })
  activeIngredients:
    | { kfaCode: string; name: string; strength: string | null }[]
    | null;

  /** updated_at dari KFA — dasar from_date sinkronisasi berikutnya */
  @Column({ name: 'kfa_updated_at', type: 'datetime', nullable: true })
  kfaUpdatedAt: Date | null;

  @Column({ name: 'synced_at', type: 'datetime' })
  syncedAt: Date;
}

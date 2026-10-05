import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

/** Racikan: SD = d.t.d (dosis demikian), EP = dibagi rata (non-d.t.d) */
export const COMPOUND_TYPES = ['SD', 'EP'] as const;
export type CompoundType = (typeof COMPOUND_TYPES)[number];

/** Satuan kekuatan zat: UCUM atau bentuk sediaan (v3-orderableDrugForm) */
export const STRENGTH_UNITS_UCUM = ['mg', 'g', 'mcg', 'mL', 'IU'] as const;
export const STRENGTH_UNITS_FORM = [
  'TAB',
  'CAP',
  'POWD',
  'OINT',
  'CRM',
  'SUPP',
  'SYRUP',
] as const;
export const STRENGTH_UNITS = [
  ...STRENGTH_UNITS_UCUM,
  ...STRENGTH_UNITS_FORM,
] as const;
export type StrengthUnit = (typeof STRENGTH_UNITS)[number];

/** Rute pemberian WHO ATC */
export const ROUTES = ['O', 'P', 'R', 'V', 'N', 'SL', 'TD'] as const;
export type RouteCode = (typeof ROUTES)[number];

export interface CompoundIngredient {
  /** Kode KFA zat aktif (91…) atau produk (92…/93…) */
  kfaCode: string;
  name: string;
  /** mis. 125 mg per 1 CAP, atau 15 TAB per 30 CAP */
  amount: number;
  amountUnit: StrengthUnit;
  perAmount: number;
  perUnit: StrengthUnit;
}

/**
 * One prescribed drug line item for an encounter's SOAP Treatment section.
 * Plain free-text fields (not linked to Gudang stock) — this documents
 * what was prescribed, it doesn't move inventory.
 */
@Entity('prescription_items')
@Index(['encounterId'])
export class PrescriptionItem extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'drug_name', type: 'varchar', length: 255 })
  drugName: string;

  /** Kode KFA (Kamus Farmasi & Alkes) — wajib agar resep bisa dikirim ke SATUSEHAT */
  @Column({ name: 'kfa_code', type: 'varchar', length: 20, nullable: true })
  kfaCode: string | null;

  /** Nama produk sesuai KFA saat dipilih */
  @Column({ name: 'kfa_name', type: 'varchar', length: 255, nullable: true })
  kfaName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dosage: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frequency: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  duration: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  quantity: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  // ── Racikan ──
  @Column({ name: 'compound_type', type: 'varchar', length: 2, nullable: true })
  compoundType: CompoundType | null;

  /** Bentuk sediaan racikan (medication-form, mis. BS047 Serbuk Oral) */
  @Column({
    name: 'compound_form_code',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  compoundFormCode: string | null;

  @Column({
    name: 'compound_form_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  compoundFormName: string | null;

  /** Satuan hasil racikan untuk jumlah (CAP, POWD, …) */
  @Column({
    name: 'compound_unit',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  compoundUnit: StrengthUnit | null;

  @Column({ type: 'json', nullable: true })
  ingredients: CompoundIngredient[] | null;

  /** Rute WHO ATC (wajib untuk racikan; non-racikan memakai rute KFA) */
  @Column({ name: 'route_code', type: 'varchar', length: 10, nullable: true })
  routeCode: RouteCode | null;

  // ── Pengeluaran obat (dispense) ──
  @Column({ name: 'dispensed_at', type: 'datetime', nullable: true })
  dispensedAt: Date | null;

  @Column({ name: 'dispensed_by', type: 'int', nullable: true })
  dispensedBy: number | null;

  @Column({ name: 'batch_number', type: 'varchar', length: 50, nullable: true })
  batchNumber: string | null;

  @Column({ name: 'batch_expiry', type: 'date', nullable: true })
  batchExpiry: string | null;

  // ── Pemberian obat di klinik (administration) ──
  @Column({ name: 'administered_at', type: 'datetime', nullable: true })
  administeredAt: Date | null;

  @Column({ name: 'administered_by', type: 'int', nullable: true })
  administeredBy: number | null;

  @Column({
    name: 'administered_dose',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  administeredDose: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}

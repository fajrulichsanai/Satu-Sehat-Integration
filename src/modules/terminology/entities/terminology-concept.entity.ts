import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TerminologySystem = 'icd10' | 'snomed';

/**
 * One code from a clinical code system (ICD-10, SNOMED CT). Loaded from
 * data/terminology by scripts/seed-terminology.js; searched by code, name
 * and `aliases` (Indonesian names, see data/dental-id.ts) via FULLTEXT.
 */
@Entity('terminology_concepts')
@Index('IDX_terminology_system_code', ['system', 'code'], { unique: true })
@Index('FT_terminology_text', ['display', 'aliases'], { fulltext: true })
export class TerminologyConcept {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 10 })
  system: TerminologySystem;

  @Column({ length: 20 })
  code: string;

  @Column({ length: 255 })
  display: string;

  @Column({ type: 'text', nullable: true })
  aliases: string | null;
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TerminologyConcept,
  TerminologySystem,
} from './entities/terminology-concept.entity';
import {
  CURATED_DIAGNOSES,
  ICD10_BLOCKS,
  ICD10_CHAPTERS,
  CuratedDiagnosis,
} from './data/dental-id';

export const TERMINOLOGY_SYSTEMS: TerminologySystem[] = ['icd10', 'snomed'];

/** InnoDB's default FULLTEXT stopwords: a "+word*" term for one of these matches nothing. */
const FT_STOPWORDS = new Set([
  'a',
  'about',
  'an',
  'are',
  'as',
  'at',
  'be',
  'by',
  'com',
  'de',
  'en',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'la',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'what',
  'when',
  'where',
  'who',
  'will',
  'with',
  'und',
  'www',
]);
const FT_MIN_TOKEN = 3; // innodb_ft_min_token_size default

export interface TerminologyHit {
  system: TerminologySystem;
  code: string;
  display: string;
  /** Indonesian name, for the diagnoses in data/dental-id.ts. */
  nameId: string | null;
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

@Injectable()
export class TerminologyService {
  private readonly curatedByIcd = new Map(
    CURATED_DIAGNOSES.map((d) => [d.icd10, d]),
  );
  private readonly curatedBySnomed = new Map(
    CURATED_DIAGNOSES.filter((d) => d.snomed).map((d) => [d.snomed!, d]),
  );

  constructor(
    @InjectRepository(TerminologyConcept)
    private readonly conceptRepository: Repository<TerminologyConcept>,
  ) {}

  /**
   * Search by code (prefix), name or other name — every typed word must
   * start a word of the name or of an Indonesian alias. Code matches come
   * first, then the Indonesian-named diagnoses, then (ICD-10) categories
   * before their sub-codes, names that start with the query, shorter names.
   * Code and text are separate queries so each can use its own index.
   */
  async search(
    system: TerminologySystem,
    query: string,
    limit = 20,
  ): Promise<TerminologyHit[]> {
    this.assertSystem(system);
    const q = (query ?? '').trim().slice(0, 100);
    if (q.length < 2) return [];
    const take = Math.min(Math.max(limit, 1), 50);
    const typed = words(q);
    const plain = q.replace(/[%_\\]/g, '');

    // 1) Code prefix — only when the query looks like a code.
    const codeQuery = q.toUpperCase().replace(/\s+/g, '');
    const looksLikeCode =
      system === 'icd10'
        ? /^[A-Z]\d[\d.]*$/.test(codeQuery)
        : /^\d{3,}$/.test(codeQuery);
    const byCode = looksLikeCode
      ? await this.conceptRepository
          .createQueryBuilder('t')
          .where('t.system = :system AND t.code LIKE :prefix', {
            system,
            prefix: `${codeQuery}%`,
          })
          .orderBy('CHAR_LENGTH(t.code)', 'ASC')
          .addOrderBy('t.code', 'ASC')
          .limit(take)
          .getMany()
      : [];

    // 2) Name / alias — FULLTEXT for words of 3+ letters, LIKE otherwise.
    const ftWords = typed.filter(
      (w) => w.length >= FT_MIN_TOKEN && !FT_STOPWORDS.has(w),
    );
    let byText: TerminologyConcept[] = [];
    // A LIKE scan over ~500k SNOMED rows is too slow; there only 3+ letter
    // words are searched (ICD-10 is small enough for LIKE on short words).
    if (typed.length && (ftWords.length || system === 'icd10')) {
      const qb = this.conceptRepository
        .createQueryBuilder('t')
        .where('t.system = :system', { system });
      if (ftWords.length) {
        qb.andWhere(
          'MATCH(t.display, t.aliases) AGAINST (:ft IN BOOLEAN MODE)',
          {
            ft: ftWords.map((w) => `+${w}*`).join(' '),
          },
        );
      } else {
        qb.andWhere('(t.display LIKE :contains OR t.aliases LIKE :contains)', {
          contains: `%${plain}%`,
        });
      }
      qb.orderBy('t.aliases IS NOT NULL', 'DESC');
      if (system === 'icd10') qb.addOrderBy('CHAR_LENGTH(t.code)', 'ASC');
      byText = await qb
        .addOrderBy('t.display LIKE :startsWith', 'DESC')
        .addOrderBy('CHAR_LENGTH(t.display)', 'ASC')
        .setParameter('startsWith', `${plain}%`)
        .limit(take * 4)
        .getMany();
      // FULLTEXT ignored the short/stop words: check every typed word here.
      byText = byText.filter((r) => {
        const curated = this.curated(system, r.code);
        const haystack = words(
          [r.display, curated?.nameId, ...(curated?.aliases ?? [])].join(' '),
        );
        return typed.every((t) => haystack.some((w) => w.startsWith(t)));
      });
    }

    const seen = new Set<string>();
    return [...byCode, ...byText]
      .filter((r) => !seen.has(r.code) && seen.add(r.code))
      .slice(0, take)
      .map((r) => ({
        system,
        code: r.code,
        display: r.display,
        nameId: this.curated(system, r.code)?.nameId ?? null,
      }));
  }

  /** Everything the "penjelasan" panel shows for one code. */
  async detail(system: TerminologySystem, code: string) {
    this.assertSystem(system);
    const concept = await this.conceptRepository.findOne({
      where: { system, code },
    });
    if (!concept) throw new NotFoundException('Kode tidak ditemukan');
    const curated = this.curated(system, code);

    let classification: {
      chapter: { roman: string; range: string; name: string } | null;
      block: { range: string; name: string } | null;
      category: { code: string; display: string } | null;
    } | null = null;
    if (system === 'icd10') {
      const cat = code.slice(0, 3);
      const chapter =
        ICD10_CHAPTERS.find((c) => cat >= c.from && cat <= c.to) ?? null;
      const block =
        ICD10_BLOCKS.find((b) => cat >= b.from && cat <= b.to) ?? null;
      const parent =
        code.length > 3
          ? await this.conceptRepository.findOne({
              where: { system, code: cat },
            })
          : null;
      classification = {
        chapter: chapter && {
          roman: chapter.roman,
          range: `${chapter.from}–${chapter.to}`,
          name: chapter.name,
        },
        block: block && {
          range: `${block.from}–${block.to}`,
          name: block.name,
        },
        category: parent && { code: parent.code, display: parent.display },
      };
    }

    let equivalent: {
      system: TerminologySystem;
      code: string;
      display: string;
    } | null = null;
    const other: TerminologySystem = system === 'icd10' ? 'snomed' : 'icd10';
    const otherCode = system === 'icd10' ? curated?.snomed : curated?.icd10;
    if (otherCode) {
      const row = await this.conceptRepository.findOne({
        where: { system: other, code: otherCode },
      });
      if (row)
        equivalent = { system: other, code: row.code, display: row.display };
    }

    return {
      system,
      code: concept.code,
      display: concept.display,
      nameId: curated?.nameId ?? null,
      aliases: curated?.aliases ?? [],
      explanation: curated?.explanation ?? null,
      classification,
      equivalent,
    };
  }

  /** Canonical names for codes being saved; throws on an unknown code. */
  async resolve(items: Array<{ system: TerminologySystem; code: string }>) {
    const out = new Map<string, TerminologyConcept>();
    for (const system of TERMINOLOGY_SYSTEMS) {
      const codes = [
        ...new Set(items.filter((i) => i.system === system).map((i) => i.code)),
      ];
      if (!codes.length) continue;
      const rows = await this.conceptRepository
        .createQueryBuilder('t')
        .where('t.system = :system AND t.code IN (:...codes)', {
          system,
          codes,
        })
        .getMany();
      for (const r of rows) out.set(`${system}:${r.code}`, r);
    }
    const missing = items.find((i) => !out.has(`${i.system}:${i.code}`));
    if (missing) {
      throw new BadRequestException(
        `Kode diagnosis ${missing.code} (${missing.system.toUpperCase()}) tidak dikenal`,
      );
    }
    return out;
  }

  /** Indonesian name for a code, when it has one. */
  nameIdFor(system: TerminologySystem, code: string): string | null {
    return this.curated(system, code)?.nameId ?? null;
  }

  private curated(
    system: TerminologySystem,
    code: string,
  ): CuratedDiagnosis | undefined {
    return system === 'icd10'
      ? this.curatedByIcd.get(code)
      : this.curatedBySnomed.get(code);
  }

  private assertSystem(system: string): asserts system is TerminologySystem {
    if (!TERMINOLOGY_SYSTEMS.includes(system as TerminologySystem)) {
      throw new BadRequestException('Sistem kode harus icd10 atau snomed');
    }
  }
}

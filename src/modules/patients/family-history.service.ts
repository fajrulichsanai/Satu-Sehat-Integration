import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { TerminologyService } from '../terminology/terminology.service';
import { SatusehatResourceLink } from '../satusehat/sync/entities/satusehat-resource-link.entity';
import { FamilyHistoryEntry, familyHistoryLinkType } from './family-history';
import { FamilyHistoryEntryDto } from './dto/patient.dto';

@Injectable()
export class FamilyHistoryService {
  constructor(
    private readonly terminology: TerminologyService,
    @InjectRepository(SatusehatResourceLink)
    private readonly linkRepo: Repository<SatusehatResourceLink>,
  ) {}

  /**
   * Ganti daftar riwayat keluarga: kode ICD-10 divalidasi & namanya diambil
   * dari terminologi. Baris yang dihapus tetapi sudah terkirim ke SATUSEHAT
   * disimpan sebagai `removed` sampai pembatalannya terkirim.
   */
  async normalize(
    entries: FamilyHistoryEntryDto[],
    previous: FamilyHistoryEntry[] | null,
    clinicId: number,
    patientId: number | null,
  ): Promise<FamilyHistoryEntry[]> {
    const items = entries.map((e) => ({
      ...e,
      code: e.code.trim().toUpperCase(),
    }));
    const concepts = items.length
      ? await this.terminology.resolve(
          items.map((e) => ({ system: 'icd10' as const, code: e.code })),
        )
      : new Map();
    const prev = new Map((previous ?? []).map((e) => [e.key, e]));
    const next: FamilyHistoryEntry[] = items.map((e) => ({
      key: e.key && prev.has(e.key) ? e.key : randomBytes(4).toString('hex'),
      relationship: e.relationship,
      code: e.code,
      display: concepts.get(`icd10:${e.code}`)!.display,
      nameId: this.terminology.nameIdFor('icd10', e.code),
      note: e.note?.trim() || null,
    }));
    const kept = new Set(next.map((e) => e.key));
    for (const old of previous ?? []) {
      if (kept.has(old.key)) continue;
      const sent =
        patientId !== null &&
        (await this.linkRepo.exists({
          where: {
            clinicId,
            localType: familyHistoryLinkType(old.key),
            localId: patientId,
          },
        }));
      if (sent) next.push({ ...old, removed: true });
    }
    return next;
  }
}

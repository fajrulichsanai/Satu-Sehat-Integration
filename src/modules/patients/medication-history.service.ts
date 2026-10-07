import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { SatusehatResourceLink } from '../satusehat/sync/entities/satusehat-resource-link.entity';
import {
  KFA_PRODUCT_CODE,
  MedicationHistoryEntry,
  medicationHistoryLinkType,
} from './medication-history';
import { MedicationHistoryEntryDto } from './dto/patient.dto';

@Injectable()
export class MedicationHistoryService {
  constructor(
    @InjectRepository(SatusehatResourceLink)
    private readonly linkRepo: Repository<SatusehatResourceLink>,
  ) {}

  /**
   * Ganti daftar riwayat obat. Baris yang dihapus tetapi sudah terkirim ke
   * SATUSEHAT disimpan sebagai `removed` sampai pembatalannya terkirim.
   */
  async normalize(
    entries: MedicationHistoryEntryDto[],
    previous: MedicationHistoryEntry[] | null,
    clinicId: number,
    patientId: number | null,
  ): Promise<MedicationHistoryEntry[]> {
    const prev = new Map((previous ?? []).map((e) => [e.key, e]));
    const next: MedicationHistoryEntry[] = entries.map((e) => {
      const kfaCode = e.kfaCode?.trim() || null;
      return {
        key: e.key && prev.has(e.key) ? e.key : randomBytes(4).toString('hex'),
        kfaCode: kfaCode && KFA_PRODUCT_CODE.test(kfaCode) ? kfaCode : null,
        name: e.name.trim(),
        dosage: e.dosage?.trim() || null,
        active: e.active ?? true,
      };
    });
    const kept = new Set(next.map((e) => e.key));
    for (const old of previous ?? []) {
      if (kept.has(old.key)) continue;
      const sent =
        patientId !== null &&
        (await this.linkRepo.exists({
          where: {
            clinicId,
            localType: medicationHistoryLinkType(old.key),
            localId: patientId,
          },
        }));
      if (sent) next.push({ ...old, removed: true });
    }
    return next;
  }
}

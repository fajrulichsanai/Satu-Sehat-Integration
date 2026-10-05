import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { ClinicalCatalogService } from '../terminology/clinical-catalog.service';
import { LabOrder } from './entities/lab-order.entity';
import { LabResult } from './entities/lab-result.entity';
import { Modality, RadiologyOrder } from './entities/radiology-order.entity';
import {
  CreateLabOrderDto,
  CreateRadiologyOrderDto,
  SaveLabResultsDto,
  UpdateLabOrderDto,
  UpdateRadiologyOrderDto,
} from './dto/diagnostics.dto';

/** Tebak modalitas DICOM dari nama/kode pemeriksaan radiologi. */
export function guessModality(display: string, name?: string | null): Modality {
  const d = `${display} ${name ?? ''}`.toLowerCase();
  if (/panoram|opg|orthopanto/.test(d)) return 'PX';
  if (/periapi|bitewing|intraoral|occlusal|oklusal|dental \(/.test(d))
    return 'IO';
  if (/^ct |\bct\b/.test(d)) return 'CT';
  if (/^mr |\bmri?\b/.test(d)) return 'MR';
  if (/^us |\busg\b|ultrason/.test(d)) return 'US';
  if (/mammo|^mg /.test(d)) return 'MG';
  if (/^nm |nuklir|scintig/.test(d)) return 'NM';
  if (/fluoro|^rf /.test(d)) return 'RF';
  if (/angio|^xa /.test(d)) return 'XA';
  return 'DX';
}

const num = (v?: number | null) =>
  v === undefined || v === null ? null : String(v);

@Injectable()
export class DiagnosticsService {
  constructor(
    @InjectRepository(LabOrder) private readonly labRepo: Repository<LabOrder>,
    @InjectRepository(LabResult)
    private readonly resultRepo: Repository<LabResult>,
    @InjectRepository(RadiologyOrder)
    private readonly radRepo: Repository<RadiologyOrder>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    private readonly catalog: ClinicalCatalogService,
  ) {}

  // ── Laboratorium ──────────────────────────────────────────────────────

  async listLab(encounterId: number, clinicId: number) {
    await this.assertEncounter(encounterId, clinicId);
    return this.labRepo.find({
      where: { encounterId },
      relations: { results: true },
      order: { id: 'ASC', results: { id: 'ASC' } },
    });
  }

  async createLab(
    encounterId: number,
    clinicId: number,
    dto: CreateLabOrderDto,
    userId: number,
  ) {
    await this.assertEncounter(encounterId, clinicId);
    const test = this.catalog.getLab(dto.code);
    if (!(test.use ?? '').toLowerCase().includes('permintaan')) {
      throw new BadRequestException(
        `${test.name} hanya untuk hasil — pilih pemeriksaan kategori Permintaan`,
      );
    }
    return this.labRepo.save(
      this.labRepo.create({
        encounterId,
        code: test.code,
        codeSystem: test.system,
        display: test.display ?? test.name ?? test.code,
        nameId: test.name ?? test.display ?? test.code,
        category: test.category,
        specimenType: dto.specimenType?.trim() || test.specimen,
        fasting: dto.fasting ?? null,
        note: dto.note?.trim() || null,
        status: 'ordered',
        createdBy: userId,
      }),
    );
  }

  async updateLab(
    encounterId: number,
    clinicId: number,
    id: number,
    dto: UpdateLabOrderDto,
    userId: number,
  ) {
    const order = await this.findLab(encounterId, clinicId, id);
    if (dto.specimenCollectedAt !== undefined) {
      order.specimenCollectedAt = new Date(dto.specimenCollectedAt);
      if (order.status === 'ordered') order.status = 'collected';
    }
    if (dto.fasting !== undefined) order.fasting = dto.fasting;
    if (dto.note !== undefined) order.note = dto.note.trim() || null;
    if (dto.conclusion !== undefined)
      order.conclusion = dto.conclusion.trim() || null;
    if (dto.status !== undefined) order.status = dto.status;
    order.updatedBy = userId;
    await this.labRepo.save(order);
    return this.findLab(encounterId, clinicId, id);
  }

  /** Simpan (ganti) seluruh hasil satu permintaan & tandai selesai. */
  async saveLabResults(
    encounterId: number,
    clinicId: number,
    id: number,
    dto: SaveLabResultsDto,
    userId: number,
  ) {
    const order = await this.findLab(encounterId, clinicId, id);
    if (order.status === 'cancelled') {
      throw new BadRequestException('Permintaan lab sudah dibatalkan');
    }
    const rows = dto.results.map((r) => {
      const test = this.catalog.getLab(r.code);
      if (!(test.use ?? '').toLowerCase().includes('hasil')) {
        throw new BadRequestException(`${test.name} bukan parameter hasil`);
      }
      let valueCodeDisplay: string | null = null;
      let valueCodeSystem: string | null = null;
      if (r.valueCode) {
        const answer = test.answers.find((a) => a.code === r.valueCode);
        if (!answer) {
          throw new BadRequestException(
            `Jawaban ${r.valueCode} tidak berlaku untuk ${test.name}`,
          );
        }
        valueCodeDisplay = answer.display;
        valueCodeSystem = answer.system;
      }
      const hasValue =
        (r.valueNumber !== undefined && r.valueNumber !== null) ||
        !!r.valueCode ||
        !!r.valueText?.trim();
      if (!hasValue) throw new BadRequestException(`Nilai ${test.name} kosong`);
      return this.resultRepo.create({
        orderId: order.id,
        code: test.code,
        codeSystem: test.system,
        display: test.display ?? test.name ?? test.code,
        nameId: test.name,
        valueNumber: num(r.valueNumber),
        unit: r.unit?.trim() || test.unit,
        valueCode: r.valueCode ?? null,
        valueCodeDisplay,
        valueCodeSystem,
        valueText: r.valueText?.trim() || null,
        refLow: num(r.refLow),
        refHigh: num(r.refHigh),
        interpretation: r.interpretation ?? null,
        createdBy: userId,
      });
    });
    await this.resultRepo.delete({ orderId: order.id });
    if (rows.length) await this.resultRepo.save(rows);
    order.status = rows.length ? 'completed' : order.status;
    order.resultedAt = rows.length
      ? (order.resultedAt ?? new Date())
      : order.resultedAt;
    if (!order.specimenCollectedAt && rows.length)
      order.specimenCollectedAt = order.resultedAt;
    if (dto.conclusion !== undefined)
      order.conclusion = dto.conclusion.trim() || null;
    order.updatedBy = userId;
    await this.labRepo.save({ ...order, results: undefined });
    return this.findLab(encounterId, clinicId, id);
  }

  async removeLab(encounterId: number, clinicId: number, id: number) {
    const order = await this.findLab(encounterId, clinicId, id);
    await this.labRepo.delete({ id: order.id });
  }

  // ── Radiologi ─────────────────────────────────────────────────────────

  async listRadiology(encounterId: number, clinicId: number) {
    await this.assertEncounter(encounterId, clinicId);
    return this.radRepo.find({ where: { encounterId }, order: { id: 'ASC' } });
  }

  async createRadiology(
    encounterId: number,
    clinicId: number,
    dto: CreateRadiologyOrderDto,
    userId: number,
  ) {
    await this.assertEncounter(encounterId, clinicId);
    const test = this.catalog.getRadiology(dto.code);
    const display = test.display ?? test.name ?? test.code;
    const saved = await this.radRepo.save(
      this.radRepo.create({
        encounterId,
        code: test.code,
        codeSystem: test.system,
        display,
        nameId: test.name ?? display,
        modality: dto.modality ?? guessModality(display, test.name),
        // sementara unik; diganti setelah ID diketahui
        accessionNumber: `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        note: dto.note?.trim() || null,
        status: 'ordered',
        createdBy: userId,
      }),
    );
    saved.accessionNumber = `ACSN${clinicId}${String(saved.id).padStart(7, '0')}`;
    return this.radRepo.save(saved);
  }

  async updateRadiology(
    encounterId: number,
    clinicId: number,
    id: number,
    dto: UpdateRadiologyOrderDto,
    userId: number,
  ) {
    const order = await this.findRadiology(encounterId, clinicId, id);
    if (dto.modality !== undefined) order.modality = dto.modality;
    if (dto.note !== undefined) order.note = dto.note.trim() || null;
    if (dto.resultText !== undefined)
      order.resultText = dto.resultText.trim() || null;
    if (dto.conclusion !== undefined)
      order.conclusion = dto.conclusion.trim() || null;
    if (dto.status !== undefined) order.status = dto.status;
    if (
      (order.resultText || order.conclusion) &&
      order.status === 'ordered' &&
      dto.status === undefined
    ) {
      order.status = 'completed';
    }
    if (order.status === 'completed' && !order.resultedAt)
      order.resultedAt = new Date();
    order.updatedBy = userId;
    return this.radRepo.save(order);
  }

  async removeRadiology(encounterId: number, clinicId: number, id: number) {
    const order = await this.findRadiology(encounterId, clinicId, id);
    await this.radRepo.delete({ id: order.id });
  }

  // ── Bantuan ───────────────────────────────────────────────────────────

  private async findLab(encounterId: number, clinicId: number, id: number) {
    await this.assertEncounter(encounterId, clinicId);
    const order = await this.labRepo.findOne({
      where: { id, encounterId },
      relations: { results: true },
      order: { results: { id: 'ASC' } },
    });
    if (!order) throw new NotFoundException('Permintaan lab tidak ditemukan');
    return order;
  }

  private async findRadiology(
    encounterId: number,
    clinicId: number,
    id: number,
  ) {
    await this.assertEncounter(encounterId, clinicId);
    const order = await this.radRepo.findOne({ where: { id, encounterId } });
    if (!order)
      throw new NotFoundException('Permintaan radiologi tidak ditemukan');
    return order;
  }

  private async assertEncounter(encounterId: number, clinicId: number) {
    const found = await this.encounterRepo.exists({
      where: { id: encounterId, clinicId },
    });
    if (!found)
      throw new NotFoundException(
        `Kunjungan dengan ID ${encounterId} tidak ditemukan`,
      );
  }
}

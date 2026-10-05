import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import {
  AdministerPrescriptionDto,
  CreatePrescriptionItemDto,
  SavePrescriptionSignatureDto,
  SetPrescriptionCodingDto,
  DispensePrescriptionDto,
  SavePrescriptionReviewDto,
} from './dto/prescription-item.dto';
import { PrescriptionReview } from './entities/prescription-review.entity';
import { PrescriptionSignature } from './entities/prescription-signature.entity';
import { PRESCRIPTION_REVIEW_QUESTIONS } from './prescription-review.questions';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(PrescriptionItem)
    private readonly itemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    @InjectRepository(PrescriptionReview)
    private readonly reviewRepository: Repository<PrescriptionReview>,
    @InjectRepository(PrescriptionSignature)
    private readonly signatureRepository: Repository<PrescriptionSignature>,
  ) {}

  async listByEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<PrescriptionItem[]> {
    await this.assertEncounterExists(encounterId, clinicId);
    return this.itemRepository.find({
      where: { encounterId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(
    encounterId: number,
    clinicId: number,
    dto: CreatePrescriptionItemDto,
    userId: number,
  ): Promise<PrescriptionItem> {
    await this.assertEncounterExists(encounterId, clinicId);
    const count = await this.itemRepository.count({ where: { encounterId } });
    const compound = !!dto.compoundType;
    const item = this.itemRepository.create({
      encounterId,
      ...dto,
      // Racikan tidak punya satu kode produk; bahan-bahannya yang berkode KFA
      kfaCode: compound ? null : (dto.kfaCode ?? null),
      kfaName: compound ? null : (dto.kfaName ?? null),
      compoundType: dto.compoundType ?? null,
      compoundFormCode: compound ? dto.compoundFormCode : null,
      compoundFormName: compound ? (dto.compoundFormName ?? null) : null,
      compoundUnit: compound ? dto.compoundUnit : null,
      ingredients: compound ? dto.ingredients : null,
      routeCode: dto.routeCode ?? dto.signa?.route ?? null,
      // Kolom lama tetap terisi (PDF/laporan lama, tampilan riwayat)
      quantity: dto.numero ? String(dto.numero) : dto.quantity,
      frequency: dto.signa?.text ?? dto.frequency,
      sortOrder: count,
      createdBy: userId,
    });
    return this.itemRepository.save(item);
  }

  /** Pasang kode KFA, atau ubah jadi racikan (bahan berkode KFA). */
  async setCoding(
    encounterId: number,
    clinicId: number,
    itemId: number,
    dto: SetPrescriptionCodingDto,
    userId: number,
  ): Promise<PrescriptionItem> {
    const item = await this.findItem(encounterId, clinicId, itemId);
    const compound = !!dto.compoundType;
    if (!compound && !dto.kfaCode) {
      throw new BadRequestException(
        'Pilih produk KFA, atau isi data racikan beserta bahannya',
      );
    }
    Object.assign(item, {
      kfaCode: compound ? null : dto.kfaCode,
      kfaName: compound ? null : (dto.kfaName ?? null),
      compoundType: dto.compoundType ?? null,
      compoundFormCode: compound ? dto.compoundFormCode : null,
      compoundFormName: compound ? (dto.compoundFormName ?? null) : null,
      compoundUnit: compound ? dto.compoundUnit : null,
      ingredients: compound ? dto.ingredients : null,
      routeCode: dto.routeCode ?? (compound ? item.routeCode : null),
      updatedBy: userId,
    });
    return this.itemRepository.save(item);
  }

  // ── Tanda tangan dokter pada resep ──

  async getSignature(encounterId: number, clinicId: number) {
    await this.assertEncounterExists(encounterId, clinicId);
    const sig = await this.signatureRepository.findOne({
      where: { encounterId },
    });
    return sig
      ? {
          signature: sig.signature,
          signedAt: sig.signedAt,
          signedBy: sig.createdBy,
        }
      : null;
  }

  async saveSignature(
    encounterId: number,
    clinicId: number,
    dto: SavePrescriptionSignatureDto,
    userId: number,
  ) {
    await this.assertEncounterExists(encounterId, clinicId);
    const existing = await this.signatureRepository.findOne({
      where: { encounterId },
    });
    const sig = existing ?? this.signatureRepository.create({ encounterId });
    Object.assign(sig, {
      signature: dto.signature,
      signedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.signatureRepository.save(sig);
    return {
      signature: saved.signature,
      signedAt: saved.signedAt,
      signedBy: userId,
    };
  }

  async removeSignature(encounterId: number, clinicId: number) {
    await this.assertEncounterExists(encounterId, clinicId);
    await this.signatureRepository.delete({ encounterId });
  }

  async remove(
    encounterId: number,
    clinicId: number,
    itemId: number,
  ): Promise<void> {
    await this.assertEncounterExists(encounterId, clinicId);
    const result = await this.itemRepository.delete({
      id: itemId,
      encounterId,
    });
    if (!result.affected) {
      throw new NotFoundException(`Resep dengan ID ${itemId} tidak ditemukan`);
    }
  }

  /** Obat diserahkan ke pasien (MedicationDispense). */
  async dispense(
    encounterId: number,
    clinicId: number,
    itemId: number,
    dto: DispensePrescriptionDto,
    userId: number,
  ): Promise<PrescriptionItem> {
    const item = await this.findItem(encounterId, clinicId, itemId);
    item.dispensedAt = dto.dispensedAt ? new Date(dto.dispensedAt) : new Date();
    item.dispensedBy = userId;
    item.batchNumber = dto.batchNumber?.trim() || null;
    item.batchExpiry = dto.batchExpiry ? dto.batchExpiry.slice(0, 10) : null;
    item.updatedBy = userId;
    return this.itemRepository.save(item);
  }

  async undoDispense(
    encounterId: number,
    clinicId: number,
    itemId: number,
    userId: number,
  ) {
    const item = await this.findItem(encounterId, clinicId, itemId);
    Object.assign(item, {
      dispensedAt: null,
      dispensedBy: null,
      batchNumber: null,
      batchExpiry: null,
      updatedBy: userId,
    });
    return this.itemRepository.save(item);
  }

  /** Obat diberikan langsung di klinik (MedicationAdministration). */
  async administer(
    encounterId: number,
    clinicId: number,
    itemId: number,
    dto: AdministerPrescriptionDto,
    userId: number,
  ): Promise<PrescriptionItem> {
    const item = await this.findItem(encounterId, clinicId, itemId);
    item.administeredAt = dto.administeredAt
      ? new Date(dto.administeredAt)
      : new Date();
    item.administeredBy = userId;
    item.administeredDose = dto.dose?.trim() || item.dosage || null;
    item.updatedBy = userId;
    return this.itemRepository.save(item);
  }

  async undoAdminister(
    encounterId: number,
    clinicId: number,
    itemId: number,
    userId: number,
  ) {
    const item = await this.findItem(encounterId, clinicId, itemId);
    Object.assign(item, {
      administeredAt: null,
      administeredBy: null,
      administeredDose: null,
      updatedBy: userId,
    });
    return this.itemRepository.save(item);
  }

  async getReview(encounterId: number, clinicId: number) {
    await this.assertEncounterExists(encounterId, clinicId);
    return this.reviewRepository.findOne({ where: { encounterId } });
  }

  /** Simpan pengkajian resep — semua pertanyaan Q0007 wajib dijawab. */
  async saveReview(
    encounterId: number,
    clinicId: number,
    dto: SavePrescriptionReviewDto,
    userId: number,
  ): Promise<PrescriptionReview> {
    await this.assertEncounterExists(encounterId, clinicId);
    const answers: PrescriptionReview['answers'] = {};
    for (const q of PRESCRIPTION_REVIEW_QUESTIONS) {
      const a = dto.answers?.[q.linkId];
      const ok =
        q.kind === 'boolean'
          ? typeof a === 'boolean'
          : a === 'sesuai' || a === 'tidak_sesuai';
      if (!ok) {
        throw new BadRequestException(
          `Pertanyaan ${q.linkId} belum dijawab: ${q.text}`,
        );
      }
      answers[q.linkId] = a;
    }
    const existing = await this.reviewRepository.findOne({
      where: { encounterId },
    });
    const review =
      existing ??
      this.reviewRepository.create({ encounterId, createdBy: userId });
    Object.assign(review, {
      answers,
      note: dto.note?.trim() || null,
      reviewedAt: new Date(),
      reviewedBy: userId,
      updatedBy: userId,
    });
    return this.reviewRepository.save(review);
  }

  private async findItem(
    encounterId: number,
    clinicId: number,
    itemId: number,
  ) {
    await this.assertEncounterExists(encounterId, clinicId);
    const item = await this.itemRepository.findOne({
      where: { id: itemId, encounterId },
    });
    if (!item)
      throw new NotFoundException(`Resep dengan ID ${itemId} tidak ditemukan`);
    return item;
  }

  private async assertEncounterExists(
    encounterId: number,
    clinicId: number,
  ): Promise<void> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Kunjungan dengan ID ${encounterId} tidak ditemukan`,
      );
    }
  }
}

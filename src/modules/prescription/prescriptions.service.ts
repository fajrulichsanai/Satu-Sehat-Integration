import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription, PrescriptionStatus } from '../prescription/entities/prescription.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { EncounterStatus } from '../../enums';
import { CreatePrescriptionDto } from './dto/prescription.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async findAll(encounterId: number, clinicId: number) {
    await this.verifyEncounter(encounterId, clinicId);
    return this.prescriptionRepository.find({
      where: { encounterId },
      relations: { medication: true },
      order: { createdAt: 'ASC' },
    });
  }

  async create(encounterId: number, clinicId: number, dto: CreatePrescriptionDto, userId: number) {
    const encounter = await this.verifyEncounter(encounterId, clinicId);

    if (encounter.status === EncounterStatus.FINISHED) {
      throw new ForbiddenException('Tidak dapat menambah resep pada encounter yang sudah selesai');
    }

    const existing = await this.prescriptionRepository.findOne({
      where: { encounterId, medicationId: dto.medicationId, status: PrescriptionStatus.ACTIVE },
    });
    if (existing) {
      throw new ConflictException('Obat sudah ada di resep encounter ini');
    }

    const prescription = this.prescriptionRepository.create({
      encounterId,
      medicationId: dto.medicationId,
      dosageInstruction: dto.dosageInstruction,
      quantity: dto.quantity,
      duration: dto.duration,
      durationUnit: dto.durationUnit,
      note: dto.note,
      status: PrescriptionStatus.ACTIVE,
      createdBy: userId,
    });

    return this.prescriptionRepository.save(prescription);
  }

  async remove(encounterId: number, prescriptionId: number, clinicId: number): Promise<void> {
    await this.verifyEncounter(encounterId, clinicId);

    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId, encounterId },
    });
    if (!prescription) throw new NotFoundException(`Resep dengan ID ${prescriptionId} tidak ditemukan`);

    if (prescription.status === PrescriptionStatus.DISPENSED) {
      throw new UnprocessableEntityException('Resep sudah di-dispense, tidak bisa dibatalkan');
    }

    await this.prescriptionRepository.remove(prescription);
  }

  private async verifyEncounter(encounterId: number, clinicId: number): Promise<Encounter> {
    const encounter = await this.encounterRepository.findOne({ where: { id: encounterId, clinicId } });
    if (!encounter) throw new NotFoundException(`Encounter dengan ID ${encounterId} tidak ditemukan`);
    return encounter;
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Dispense } from './entities/dispense.entity';
import {
  Prescription,
  PrescriptionStatus,
} from '../prescription/entities/prescription.entity';
import { Medication } from '../medications/entities/medication.entity';
import {
  MedicationStockLog,
  StockLogType,
} from '../medication-stock-log/entities/medication-stock-log.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { DispenseMedicationsDto } from './dto/dispense.dto';

@Injectable()
export class DispenseService {
  constructor(
    @InjectRepository(Dispense)
    private readonly dispenseRepository: Repository<Dispense>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    private readonly dataSource: DataSource,
  ) {}

  async dispense(
    encounterId: number,
    clinicId: number,
    dto: DispenseMedicationsDto,
    userId: number,
  ) {
    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter)
      throw new NotFoundException(
        `Encounter dengan ID ${encounterId} tidak ditemukan`,
      );

    return this.dataSource.transaction(async (manager) => {
      const results: any[] = [];
      const now = new Date();

      for (const item of dto.items) {
        const prescription = await manager.findOne(Prescription, {
          where: { id: item.prescriptionId, encounterId },
        });
        if (!prescription) {
          throw new NotFoundException(
            `Resep ID ${item.prescriptionId} tidak ditemukan`,
          );
        }
        if (prescription.status === PrescriptionStatus.DISPENSED) {
          throw new ConflictException(
            `Resep ID ${item.prescriptionId} sudah pernah di-dispense`,
          );
        }

        const medication = await manager.findOne(Medication, {
          where: { id: item.medicationId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!medication) {
          throw new NotFoundException(
            `Obat ID ${item.medicationId} tidak ditemukan`,
          );
        }
        if (medication.quantity < item.quantityDispensed) {
          throw new UnprocessableEntityException(
            `Stok obat '${medication.name}' tidak mencukupi (stok: ${medication.quantity}, diminta: ${item.quantityDispensed})`,
          );
        }

        const previousQuantity = medication.quantity;
        const newQuantity = previousQuantity - item.quantityDispensed;

        // Deduct stock
        medication.quantity = newQuantity;
        medication.updatedBy = userId;
        await manager.save(medication);

        // Create stock log
        await manager.save(MedicationStockLog, {
          medicationId: medication.id,
          type: StockLogType.OUT,
          quantity: item.quantityDispensed,
          previousQuantity,
          newQuantity,
          reason: `Dispense untuk encounter #${encounterId}`,
          referenceType: 'dispense',
          createdBy: userId,
        });

        // Create dispense record
        const dispense = await manager.save(Dispense, {
          encounterId,
          prescriptionId: item.prescriptionId,
          medicationId: item.medicationId,
          quantityDispensed: item.quantityDispensed,
          dispensedAt: now,
          createdBy: userId,
        });

        // Update stock log with reference id
        await manager.update(
          MedicationStockLog,
          {
            medicationId: medication.id,
            referenceType: 'dispense',
            referenceId: null,
          },
          { referenceId: dispense.id },
        );

        // Mark prescription dispensed
        prescription.status = PrescriptionStatus.DISPENSED;
        prescription.dispensedAt = now;
        prescription.updatedBy = userId;
        await manager.save(prescription);

        results.push({
          prescriptionId: item.prescriptionId,
          medicationName: medication.name,
          quantityDispensed: item.quantityDispensed,
          stockRemaining: newQuantity,
        });
      }

      return { dispensedAt: now, items: results };
    });
  }
}

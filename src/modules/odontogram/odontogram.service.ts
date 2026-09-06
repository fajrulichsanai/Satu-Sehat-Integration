import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ToothCondition } from './entities/tooth-condition.entity';
import { DentalBridge } from './entities/dental-bridge.entity';
import { Patient } from '../patients/entities/patient.entity';
import {
  UpsertToothConditionDto,
  CreateDentalBridgeDto,
} from './dto/odontogram.dto';

const SURFACE_FIELDS: (keyof UpsertToothConditionDto)[] = [
  'surfaceMesial',
  'surfaceDistal',
  'surfaceVestibular',
  'surfaceLingual',
  'surfaceOcclusal',
];

@Injectable()
export class OdontogramService {
  constructor(
    @InjectRepository(ToothCondition)
    private readonly toothRepository: Repository<ToothCondition>,
    @InjectRepository(DentalBridge)
    private readonly bridgeRepository: Repository<DentalBridge>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async getOdontogram(
    patientId: number,
    clinicId: number,
  ): Promise<{ teeth: ToothCondition[]; bridges: DentalBridge[] }> {
    await this.assertPatientExists(patientId, clinicId);
    const [teeth, bridges] = await Promise.all([
      this.toothRepository.find({ where: { patientId } }),
      this.bridgeRepository.find({
        where: { patientId },
        order: { id: 'ASC' },
      }),
    ]);
    return { teeth, bridges };
  }

  async upsertTooth(
    patientId: number,
    clinicId: number,
    toothNumber: number,
    dto: UpsertToothConditionDto,
    userId: number,
  ): Promise<ToothCondition> {
    await this.assertPatientExists(patientId, clinicId);

    let tooth = await this.toothRepository.findOne({
      where: { patientId, toothNumber },
    });

    if (!tooth) {
      tooth = this.toothRepository.create({
        patientId,
        toothNumber,
        wholeCondition: dto.wholeCondition,
        notes: dto.notes,
        createdBy: userId,
        ...this.pickSurfaces(dto),
      });
    } else {
      Object.assign(tooth, {
        wholeCondition: dto.wholeCondition ?? tooth.wholeCondition,
        notes: dto.notes ?? tooth.notes,
        updatedBy: userId,
        ...this.pickSurfaces(dto, tooth),
      });
    }

    return this.toothRepository.save(tooth);
  }

  async createBridge(
    patientId: number,
    clinicId: number,
    dto: CreateDentalBridgeDto,
    userId: number,
  ): Promise<DentalBridge> {
    await this.assertPatientExists(patientId, clinicId);
    const bridge = this.bridgeRepository.create({
      patientId,
      fromTooth: dto.fromTooth,
      toTooth: dto.toTooth,
      label: dto.label || 'Gigi Tiruan Cekat',
      notes: dto.notes,
      createdBy: userId,
    });
    return this.bridgeRepository.save(bridge);
  }

  async removeBridge(
    patientId: number,
    clinicId: number,
    bridgeId: number,
  ): Promise<void> {
    await this.assertPatientExists(patientId, clinicId);
    const result = await this.bridgeRepository.delete({
      id: bridgeId,
      patientId,
    });
    if (!result.affected) {
      throw new NotFoundException(
        `Bridge dengan ID ${bridgeId} tidak ditemukan`,
      );
    }
  }

  private pickSurfaces(
    dto: UpsertToothConditionDto,
    fallback?: ToothCondition,
  ): Partial<ToothCondition> {
    const result: Record<string, unknown> = {};
    for (const field of SURFACE_FIELDS) {
      result[field] = dto[field] ?? (fallback ? fallback[field] : undefined);
    }
    return result;
  }

  private async assertPatientExists(
    patientId: number,
    clinicId: number,
  ): Promise<void> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, clinicId },
    });
    if (!patient) {
      throw new NotFoundException(
        `Pasien dengan ID ${patientId} tidak ditemukan`,
      );
    }
  }
}

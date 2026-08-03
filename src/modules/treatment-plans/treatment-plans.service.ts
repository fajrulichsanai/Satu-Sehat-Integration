import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TreatmentPlan } from './entities/treatment-plan.entity';
import { TreatmentPlanSession } from './entities/treatment-plan-session.entity';
import { TreatmentPlanStatus } from '../../enums';
import {
  CreateTreatmentPlanDto,
  CreateTreatmentPlanSessionDto,
  UpdateTreatmentPlanDto,
  UpdateTreatmentPlanSessionDto,
} from './dto/treatment-plan.dto';

@Injectable()
export class TreatmentPlansService {
  constructor(
    @InjectRepository(TreatmentPlan)
    private readonly treatmentPlanRepository: Repository<TreatmentPlan>,
    @InjectRepository(TreatmentPlanSession)
    private readonly sessionRepository: Repository<TreatmentPlanSession>,
  ) {}

  async findByPatient(
    patientId: number,
    clinicId: number,
  ): Promise<TreatmentPlan[]> {
    return this.treatmentPlanRepository.find({
      where: { patientId, clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, clinicId: number): Promise<TreatmentPlan> {
    const plan = await this.treatmentPlanRepository.findOne({
      where: { id, clinicId },
    });
    if (!plan) {
      throw new NotFoundException(
        `Treatment plan dengan ID ${id} tidak ditemukan`,
      );
    }
    return plan;
  }

  async findSessions(
    treatmentPlanId: number,
    clinicId: number,
  ): Promise<TreatmentPlanSession[]> {
    await this.findOne(treatmentPlanId, clinicId);
    return this.sessionRepository.find({
      where: { treatmentPlanId },
      order: { stageNumber: 'ASC' },
    });
  }

  async create(
    clinicId: number,
    dto: CreateTreatmentPlanDto,
    userId: number,
  ): Promise<TreatmentPlan> {
    const plan = this.treatmentPlanRepository.create({
      clinicId,
      patientId: dto.patientId,
      treatmentType: dto.treatmentType,
      label: dto.label,
      totalStages: dto.totalStages,
      currentStage: 0,
      startDate: dto.startDate,
      createdBy: userId,
    });
    return this.treatmentPlanRepository.save(plan);
  }

  async update(
    id: number,
    clinicId: number,
    dto: UpdateTreatmentPlanDto,
    userId: number,
  ): Promise<TreatmentPlan> {
    const plan = await this.findOne(id, clinicId);
    Object.assign(plan, {
      label: dto.label ?? plan.label,
      totalStages: dto.totalStages ?? plan.totalStages,
      status: dto.status ?? plan.status,
      startDate: dto.startDate ?? plan.startDate,
      updatedBy: userId,
    });
    return this.treatmentPlanRepository.save(plan);
  }

  async addSession(
    treatmentPlanId: number,
    clinicId: number,
    dto: CreateTreatmentPlanSessionDto,
    userId: number,
  ): Promise<TreatmentPlanSession> {
    const plan = await this.findOne(treatmentPlanId, clinicId);

    const stageNumber = plan.currentStage + 1;
    const session = this.sessionRepository.create({
      treatmentPlanId,
      stageNumber,
      encounterId: dto.encounterId,
      date: dto.date,
      notes: dto.notes,
      status: dto.status,
      createdBy: userId,
    });
    const saved = await this.sessionRepository.save(session);

    plan.currentStage = stageNumber;
    if (plan.totalStages && plan.currentStage >= plan.totalStages) {
      plan.status = TreatmentPlanStatus.COMPLETED;
    }
    plan.updatedBy = userId;
    await this.treatmentPlanRepository.save(plan);

    return saved;
  }

  async updateSession(
    sessionId: number,
    treatmentPlanId: number,
    clinicId: number,
    dto: UpdateTreatmentPlanSessionDto,
    userId: number,
  ): Promise<TreatmentPlanSession> {
    await this.findOne(treatmentPlanId, clinicId);
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, treatmentPlanId },
    });
    if (!session) {
      throw new NotFoundException(
        `Sesi treatment dengan ID ${sessionId} tidak ditemukan`,
      );
    }
    Object.assign(session, {
      date: dto.date ?? session.date,
      notes: dto.notes ?? session.notes,
      status: dto.status ?? session.status,
      updatedBy: userId,
    });
    return this.sessionRepository.save(session);
  }
}

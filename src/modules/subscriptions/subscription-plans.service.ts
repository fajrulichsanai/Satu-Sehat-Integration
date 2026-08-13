import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
  ) {}

  findAll() {
    return this.planRepository.find({ order: { durationDays: 'ASC' } });
  }

  async findOne(id: number) {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Paket langganan tidak ditemukan',
        },
      });
    }
    return plan;
  }

  create(dto: CreateSubscriptionPlanDto, createdBy: number) {
    const plan = this.planRepository.create({ ...dto, createdBy });
    return this.planRepository.save(plan);
  }

  async update(id: number, dto: UpdateSubscriptionPlanDto, updatedBy: number) {
    const plan = await this.findOne(id);
    Object.assign(plan, dto, { updatedBy });
    return this.planRepository.save(plan);
  }

  async remove(id: number) {
    const plan = await this.findOne(id);
    plan.isActive = false;
    await this.planRepository.save(plan);
  }
}

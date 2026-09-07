import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnerClinicLink } from './entities/owner-clinic-link.entity';
import { User } from '../users/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { UserRole } from '../../enums';
import { DashboardService } from '../dashboard/dashboard.service';

@Injectable()
export class MultiClinicService {
  constructor(
    @InjectRepository(OwnerClinicLink)
    private readonly linkRepository: Repository<OwnerClinicLink>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly dashboardService: DashboardService,
  ) {}

  /** Super Admin: daftar semua akun multi-klinik owner beserta klinik yang dimiliki. */
  async listOwners() {
    const owners = await this.userRepository.find({
      where: { role: UserRole.MULTI_CLINIC_OWNER },
      order: { name: 'ASC' },
    });
    const links = await this.linkRepository.find({
      relations: { clinic: true },
    });
    const clinicsByOwner = new Map<number, Clinic[]>();
    for (const link of links) {
      const list = clinicsByOwner.get(link.ownerId) ?? [];
      list.push(link.clinic);
      clinicsByOwner.set(link.ownerId, list);
    }
    return owners.map((o) => ({
      id: o.id,
      name: o.name,
      email: o.email,
      isActive: o.isActive,
      clinics: clinicsByOwner.get(o.id) ?? [],
    }));
  }

  /** Super Admin: hubungkan sebuah klinik ke akun multi-klinik owner. */
  async linkClinic(ownerId: number, clinicId: number, userId: number) {
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.MULTI_CLINIC_OWNER) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_OWNER',
          message: 'User bukan akun multi-klinik owner',
        },
      });
    }
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });
    if (!clinic) {
      throw new NotFoundException({
        success: false,
        error: { code: 'CLINIC_NOT_FOUND', message: 'Klinik tidak ditemukan' },
      });
    }

    const existing = await this.linkRepository.findOne({
      where: { ownerId, clinicId },
    });
    if (existing) return existing;

    const created = this.linkRepository.create({
      ownerId,
      clinicId,
      createdBy: userId,
    });
    return this.linkRepository.save(created);
  }

  /** Super Admin: putuskan hubungan klinik dari akun multi-klinik owner. */
  async unlinkClinic(ownerId: number, clinicId: number) {
    await this.linkRepository.delete({ ownerId, clinicId });
  }

  /** Multi-klinik owner: daftar klinik miliknya sendiri. */
  async getMyClinics(ownerId: number) {
    const links = await this.linkRepository.find({
      where: { ownerId },
      relations: { clinic: true },
      order: { id: 'ASC' },
    });
    return links.map((l) => l.clinic);
  }

  /** Multi-klinik owner: dashboard ringkasan gabungan lintas klinik miliknya. */
  async getDashboard(ownerId: number) {
    const clinics = await this.getMyClinics(ownerId);

    const perClinic = await Promise.all(
      clinics.map(async (clinic) => ({
        clinic: { id: clinic.id, name: clinic.name },
        summary: await this.dashboardService.getSummary(clinic.id),
      })),
    );

    const totals = perClinic.reduce(
      (acc, row) => ({
        totalPatients: acc.totalPatients + row.summary.totalPatients,
        activePractitioners:
          acc.activePractitioners + row.summary.activePractitioners,
        todayVisits: acc.todayVisits + row.summary.todayVisits,
        monthlyRevenue: acc.monthlyRevenue + row.summary.monthlyRevenue,
        totalTransactions:
          acc.totalTransactions + row.summary.totalTransactions,
      }),
      {
        totalPatients: 0,
        activePractitioners: 0,
        todayVisits: 0,
        monthlyRevenue: 0,
        totalTransactions: 0,
      },
    );

    return { totals, clinics: perClinic };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { Billing } from '../billing/entities/billing.entity';
import { Tarif } from '../tarif/entities/tarif.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Practitioner)
    private readonly practitionerRepo: Repository<Practitioner>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Billing)
    private readonly billingRepo: Repository<Billing>,
    @InjectRepository(Tarif)
    private readonly tarifRepo: Repository<Tarif>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getSummary(clinicId: number) {
    const [
      totalPatients,
      activePractitioners,
      todayVisits,
      pendingVisits,
      monthlyRevenueRow,
      activeTarifs,
      totalTransactions,
      registeredUsers,
    ] = await Promise.all([
      this.patientRepo.count({ where: { clinicId } }),
      this.practitionerRepo.count({ where: { clinicId, isActive: true } }),
      this.encounterRepo
        .createQueryBuilder('e')
        .where('e.clinicId = :clinicId', { clinicId })
        .andWhere('DATE(e.arrivedTime) = CURDATE()')
        .getCount(),
      this.encounterRepo
        .createQueryBuilder('e')
        .where('e.clinicId = :clinicId', { clinicId })
        .andWhere('DATE(e.arrivedTime) = CURDATE()')
        .andWhere("e.status = 'arrived'")
        .getCount(),
      this.billingRepo
        .createQueryBuilder('b')
        .select('SUM(b.grandTotal)', 'total')
        .where('b.clinicId = :clinicId', { clinicId })
        .andWhere('MONTH(b.createdAt) = MONTH(CURDATE())')
        .andWhere('YEAR(b.createdAt) = YEAR(CURDATE())')
        .andWhere("b.status != 'cancelled'")
        .getRawOne(),
      this.tarifRepo.count({ where: { clinicId, isActive: true } }),
      this.billingRepo.count({ where: { clinicId } }),
      this.userRepo.count({ where: { clinicId } }),
    ]);

    return {
      totalPatients,
      activePractitioners,
      todayVisits,
      pendingVisits,
      monthlyRevenue: parseFloat(monthlyRevenueRow?.total || 0),
      activeTarifs,
      totalTransactions,
      registeredUsers,
    };
  }

  async getRecentActivity(clinicId: number, limit = 10) {
    const recentEncounters = await this.encounterRepo
      .createQueryBuilder('e')
      .leftJoin('e.patient', 'patient')
      .leftJoin('e.practitioner', 'practitioner')
      .select([
        'e.id AS id',
        'e.status AS status',
        'e.finishedTime AS finishedTime',
        'e.arrivedTime AS arrivedTime',
        'e.chiefComplaint AS chiefComplaint',
        'patient.name AS patientName',
        'practitioner.name AS practitionerName',
      ])
      .where('e.clinicId = :clinicId', { clinicId })
      .orderBy('e.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany();

    const recentBillings = await this.billingRepo
      .createQueryBuilder('b')
      .select([
        'b.id AS id',
        'b.grandTotal AS grandTotal',
        'b.status AS status',
        'b.createdAt AS createdAt',
      ])
      .where('b.clinicId = :clinicId', { clinicId })
      .orderBy('b.createdAt', 'DESC')
      .limit(limit)
      .getRawMany();

    const activities = [
      ...recentEncounters.map((e) => ({
        type: 'encounter' as const,
        title:
          e.status === 'finished'
            ? `${e.patientName} menyelesaikan kunjungan`
            : `${e.patientName} ${e.status === 'arrived' ? 'menunggu' : 'sedang'} kunjungan`,
        detail: `${e.chiefComplaint || 'Kunjungan'} · ${e.practitionerName || '-'}`,
        timestamp: e.finishedTime || e.arrivedTime,
        status: e.status,
      })),
      ...recentBillings.map((b) => ({
        type: 'billing' as const,
        title: 'Transaksi baru tercatat',
        detail: `Rp ${Number(b.grandTotal).toLocaleString('id-ID')} · ${b.status}`,
        timestamp: b.createdAt,
        status: b.status,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);

    return activities;
  }

  async getModuleHighlights(clinicId: number) {
    const summary = await this.getSummary(clinicId);

    const [revenueWeekRow] = await this.billingRepo.query(
      `SELECT SUM(grand_total) AS total
       FROM billings
       WHERE clinic_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         AND status != 'cancelled'`,
      [clinicId],
    );

    return {
      pasien: { total: summary.totalPatients },
      tarif: { total: summary.activeTarifs },
      kunjungan: {
        total: summary.todayVisits,
        pending: summary.pendingVisits,
      },
      transaksi: { total: summary.totalTransactions },
      laporanKeuangan: {
        total7Hari: parseFloat(revenueWeekRow?.total || 0),
      },
      userManagement: { total: summary.registeredUsers },
    };
  }
}

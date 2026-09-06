import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { Billing } from '../billing/entities/billing.entity';
import { Payment } from '../payments/entities/payment.entity';
import {
  SatusehatSyncLog,
  SyncLogStatus,
} from '../satusehat/sync/entities/satusehat-sync-log.entity';
import { UserRole } from '../../enums/user-role.enum';
import {
  DoctorFeeShareReportQueryDto,
  FinancialReportQueryDto,
  FinancialVisitDetailQueryDto,
  RetrySyncDto,
  SatusehatSyncReportQueryDto,
  VisitReportQueryDto,
} from './dto/report.dto';
import { BillingItem } from '../billing-item/entities/billing-item.entity';
import {
  DoctorFeeConfig,
  FeeType,
} from '../doctor-fee/entities/doctor-fee-config.entity';
import { OperationalRecord } from '../operational-records/entities/operational-record.entity';

export interface DoctorFeeShareBreakdownItem {
  tarifId: number;
  tarifName: string;
  count: number;
  feeType: FeeType;
  feeValue: number;
  totalShare: number;
}

export interface DoctorFeeShareEntry {
  practitionerId: number;
  practitionerName: string;
  breakdown: DoctorFeeShareBreakdownItem[];
  totalTindakan: number;
  totalShareFee: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Billing)
    private readonly billingRepo: Repository<Billing>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
    @InjectRepository(BillingItem)
    private readonly billingItemRepo: Repository<BillingItem>,
    @InjectRepository(DoctorFeeConfig)
    private readonly doctorFeeConfigRepo: Repository<DoctorFeeConfig>,
    @InjectRepository(OperationalRecord)
    private readonly operationalRecordRepo: Repository<OperationalRecord>,
  ) {}

  async getDoctorFeeShareReport(
    clinicId: number,
    query: DoctorFeeShareReportQueryDto,
  ) {
    const rows = await this.billingItemRepo.query(
      `SELECT
         pr.id AS practitionerId,
         pr.name AS practitionerName,
         t.id AS tarifId,
         t.name AS tarifName,
         t.harga_jual AS hargaJual,
         SUM(bi.quantity) AS count,
         dfc.fee_type AS feeType,
         dfc.fee_value AS feeValue
       FROM billing_items bi
       JOIN billings b ON bi.billing_id = b.id
       JOIN encounters e ON b.encounter_id = e.id
       JOIN practitioners pr ON e.practitioner_id = pr.id
       JOIN tarifs t ON bi.tarif_id = t.id
       LEFT JOIN doctor_fee_configs dfc
         ON dfc.tarif_id = t.id AND dfc.clinic_id = b.clinic_id
       WHERE b.clinic_id = ?
         AND b.status != 'cancelled'
         AND YEAR(b.created_at) = ?
         AND MONTH(b.created_at) = ?
       GROUP BY pr.id, pr.name, t.id, t.name, t.harga_jual, dfc.fee_type, dfc.fee_value
       ORDER BY pr.id ASC`,
      [clinicId, query.year, query.month],
    );

    const byPractitioner = new Map<number, DoctorFeeShareEntry>();

    for (const row of rows as any[]) {
      const count = parseInt(row.count, 10);
      const hargaJual = parseFloat(row.hargaJual || 0);
      const feeType: FeeType = row.feeType || FeeType.PERCENTAGE;
      const feeValue = parseFloat(row.feeValue || 0);
      const totalShare =
        feeType === FeeType.FIXED
          ? count * feeValue
          : count * (hargaJual * (feeValue / 100));

      const entry: DoctorFeeShareEntry = byPractitioner.get(
        row.practitionerId,
      ) ?? {
        practitionerId: row.practitionerId,
        practitionerName: row.practitionerName,
        breakdown: [],
        totalTindakan: 0,
        totalShareFee: 0,
      };

      entry.breakdown.push({
        tarifId: row.tarifId,
        tarifName: row.tarifName,
        count,
        feeType,
        feeValue,
        totalShare,
      });
      entry.totalTindakan += count;
      entry.totalShareFee += totalShare;

      byPractitioner.set(row.practitionerId, entry);
    }

    const data = Array.from(byPractitioner.values())
      .map((entry) => ({
        ...entry,
        breakdown: entry.breakdown.sort((a, b) => b.totalShare - a.totalShare),
      }))
      .sort((a, b) => b.totalShareFee - a.totalShareFee);

    return { success: true, data };
  }

  async getVisitReport(
    clinicId: number,
    query: VisitReportQueryDto,
    user: any,
  ) {
    const qb = this.encounterRepo
      .createQueryBuilder('e')
      .leftJoin('e.patient', 'patient')
      .leftJoin('e.practitioner', 'practitioner')
      .select([
        'e.id',
        'e.status',
        'e.arrivedTime',
        'e.inProgressTime',
        'e.finishedTime',
        'patient.name',
        'practitioner.name',
      ])
      .where('e.clinicId = :clinicId', { clinicId })
      .andWhere('DATE(e.arrivedTime) BETWEEN :dateFrom AND :dateTo', {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });

    if (user.role === UserRole.DOKTER) {
      qb.andWhere(
        'e.practitionerId = (SELECT id FROM practitioners WHERE user_id = :uid LIMIT 1)',
        { uid: user.userId },
      );
    } else if (query.practitionerId) {
      qb.andWhere('e.practitionerId = :pid', { pid: query.practitionerId });
    }

    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const [encounters, total] = await qb
      .orderBy('e.arrivedTime', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Aggregations via raw queries
    const [summaryRows] = await this.encounterRepo.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'finished') AS finished,
         SUM(status = 'cancelled') AS cancelled,
         SUM(status = 'in_progress') AS inProgress,
         AVG(CASE WHEN finished_time IS NOT NULL AND in_progress_time IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, in_progress_time, finished_time) END) AS avgDuration
       FROM encounters
       WHERE clinic_id = ? AND DATE(arrived_time) BETWEEN ? AND ?`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byDay = await this.encounterRepo.query(
      `SELECT DATE(arrived_time) AS date, COUNT(*) AS count
       FROM encounters
       WHERE clinic_id = ? AND DATE(arrived_time) BETWEEN ? AND ?
       GROUP BY DATE(arrived_time)
       ORDER BY date ASC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byDoctor = await this.encounterRepo.query(
      `SELECT p.name AS practitionerName, COUNT(*) AS count
       FROM encounters e JOIN practitioners p ON e.practitioner_id = p.id
       WHERE e.clinic_id = ? AND DATE(e.arrived_time) BETWEEN ? AND ?
       GROUP BY p.id, p.name
       ORDER BY count DESC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    // ----- Demografi pasien: gender, kelompok usia, pasien baru vs lama -----
    // Counted per KUNJUNGAN (encounter), not per unique patient, to stay
    // consistent with byDay/byDoctor above (a patient visiting 3x in the
    // range contributes 3x here).
    const byGender = await this.encounterRepo.query(
      `SELECT p.gender AS gender, COUNT(*) AS count
       FROM encounters e JOIN patients p ON e.patient_id = p.id
       WHERE e.clinic_id = ? AND DATE(e.arrived_time) BETWEEN ? AND ?
       GROUP BY p.gender`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byAgeGroupRaw = await this.encounterRepo.query(
      `SELECT
         CASE
           WHEN p.birth_date IS NULL THEN 'Tidak diketahui'
           WHEN TIMESTAMPDIFF(YEAR, p.birth_date, e.arrived_time) <= 12 THEN '0-12 (Anak)'
           WHEN TIMESTAMPDIFF(YEAR, p.birth_date, e.arrived_time) <= 17 THEN '13-17 (Remaja)'
           WHEN TIMESTAMPDIFF(YEAR, p.birth_date, e.arrived_time) <= 25 THEN '18-25 (Dewasa Muda)'
           WHEN TIMESTAMPDIFF(YEAR, p.birth_date, e.arrived_time) <= 40 THEN '26-40 (Dewasa)'
           WHEN TIMESTAMPDIFF(YEAR, p.birth_date, e.arrived_time) <= 60 THEN '41-60 (Paruh Baya)'
           ELSE '60+ (Lansia)'
         END AS ageGroup,
         COUNT(*) AS count
       FROM encounters e JOIN patients p ON e.patient_id = p.id
       WHERE e.clinic_id = ? AND DATE(e.arrived_time) BETWEEN ? AND ?
       GROUP BY ageGroup`,
      [clinicId, query.dateFrom, query.dateTo],
    );
    const AGE_GROUP_ORDER = [
      '0-12 (Anak)',
      '13-17 (Remaja)',
      '18-25 (Dewasa Muda)',
      '26-40 (Dewasa)',
      '41-60 (Paruh Baya)',
      '60+ (Lansia)',
      'Tidak diketahui',
    ];
    const byAgeGroup = AGE_GROUP_ORDER.map((group) => ({
      group,
      count: parseInt(
        byAgeGroupRaw.find((r: any) => r.ageGroup === group)?.count || 0,
        10,
      ),
    })).filter((g) => g.count > 0);

    const newVsReturningRaw = await this.encounterRepo.query(
      `SELECT
         CASE WHEN fv.firstDate < ? THEN 'returning' ELSE 'new' END AS patientType,
         COUNT(*) AS count
       FROM encounters e
       JOIN (
         SELECT patient_id, MIN(DATE(arrived_time)) AS firstDate
         FROM encounters
         WHERE clinic_id = ?
         GROUP BY patient_id
       ) fv ON fv.patient_id = e.patient_id
       WHERE e.clinic_id = ? AND DATE(e.arrived_time) BETWEEN ? AND ?
       GROUP BY patientType`,
      [query.dateFrom, clinicId, clinicId, query.dateFrom, query.dateTo],
    );
    const newVsReturning = {
      new: parseInt(
        newVsReturningRaw.find((r: any) => r.patientType === 'new')?.count || 0,
        10,
      ),
      returning: parseInt(
        newVsReturningRaw.find((r: any) => r.patientType === 'returning')
          ?.count || 0,
        10,
      ),
    };

    // ----- Tindakan (procedures performed) selama periode -----
    const procedureRows = await this.encounterRepo.query(
      `SELECT t.name AS tindakan, t.kategori AS kategori, SUM(bi.quantity) AS count
       FROM billing_items bi
       JOIN billings b ON bi.billing_id = b.id
       JOIN encounters e ON b.encounter_id = e.id
       JOIN tarifs t ON bi.tarif_id = t.id
       WHERE e.clinic_id = ? AND DATE(e.arrived_time) BETWEEN ? AND ?
         AND b.status != 'cancelled'
       GROUP BY t.id, t.name, t.kategori
       ORDER BY count DESC`,
      [clinicId, query.dateFrom, query.dateTo],
    );
    const topProcedures = procedureRows.slice(0, 10).map((r: any) => ({
      tarifName: r.tindakan,
      kategori: r.kategori,
      count: parseInt(r.count, 10),
    }));
    const kategoriTotals = new Map<string, number>();
    for (const r of procedureRows as any[]) {
      const kategori = r.kategori || 'Lainnya';
      kategoriTotals.set(
        kategori,
        (kategoriTotals.get(kategori) || 0) + parseInt(r.count, 10),
      );
    }
    const byKategori = Array.from(kategoriTotals.entries())
      .map(([kategori, count]) => ({ kategori, count }))
      .sort((a, b) => b.count - a.count);
    const totalProcedures = byKategori.reduce((sum, k) => sum + k.count, 0);
    const avgProceduresPerVisit =
      parseInt(summaryRows.total) > 0
        ? parseFloat((totalProcedures / parseInt(summaryRows.total)).toFixed(2))
        : 0;

    // ----- Pola waktu: jam tersibuk & hari dalam seminggu -----
    const byHourRaw = await this.encounterRepo.query(
      `SELECT HOUR(arrived_time) AS hour, COUNT(*) AS count
       FROM encounters
       WHERE clinic_id = ? AND DATE(arrived_time) BETWEEN ? AND ?
       GROUP BY hour`,
      [clinicId, query.dateFrom, query.dateTo],
    );
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: parseInt(
        byHourRaw.find((r: any) => parseInt(r.hour, 10) === hour)?.count || 0,
        10,
      ),
    }));

    const byDayOfWeekRaw = await this.encounterRepo.query(
      `SELECT DAYOFWEEK(arrived_time) AS dow, COUNT(*) AS count
       FROM encounters
       WHERE clinic_id = ? AND DATE(arrived_time) BETWEEN ? AND ?
       GROUP BY dow`,
      [clinicId, query.dateFrom, query.dateTo],
    );
    // MySQL DAYOFWEEK: 1=Minggu ... 7=Sabtu. Displayed Senin -> Minggu.
    const DOW_LABELS = [
      'Minggu',
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
    ];
    const DOW_DISPLAY_ORDER = [2, 3, 4, 5, 6, 7, 1];
    const byDayOfWeek = DOW_DISPLAY_ORDER.map((dow) => ({
      day: DOW_LABELS[dow - 1],
      count: parseInt(
        byDayOfWeekRaw.find((r: any) => parseInt(r.dow, 10) === dow)?.count ||
          0,
        10,
      ),
    }));

    // ----- Perbandingan periode sebelumnya (durasi sama, langsung sebelum dateFrom) -----
    const rangeDays =
      Math.round(
        (new Date(`${query.dateTo}T00:00:00`).getTime() -
          new Date(`${query.dateFrom}T00:00:00`).getTime()) /
          86400000,
      ) + 1;
    const prevDateTo = new Date(`${query.dateFrom}T00:00:00`);
    prevDateTo.setDate(prevDateTo.getDate() - 1);
    const prevDateFrom = new Date(prevDateTo);
    prevDateFrom.setDate(prevDateFrom.getDate() - (rangeDays - 1));
    const toIso = (d: Date) => d.toISOString().slice(0, 10);

    const [prevSummaryRow] = await this.encounterRepo.query(
      `SELECT COUNT(*) AS total
       FROM encounters
       WHERE clinic_id = ? AND DATE(arrived_time) BETWEEN ? AND ?`,
      [clinicId, toIso(prevDateFrom), toIso(prevDateTo)],
    );
    const previousTotal = parseInt(prevSummaryRow?.total || 0, 10);
    const currentTotal = parseInt(summaryRows.total);
    const changePercent =
      previousTotal > 0
        ? parseFloat(
            (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1),
          )
        : null;

    return {
      data: {
        summary: {
          total: parseInt(summaryRows.total),
          finished: parseInt(summaryRows.finished),
          cancelled: parseInt(summaryRows.cancelled),
          inProgress: parseInt(summaryRows.inProgress),
          avgDurationMinutes: summaryRows.avgDuration
            ? Math.round(parseFloat(summaryRows.avgDuration))
            : null,
        },
        byDay: byDay.map((r: any) => ({
          date: r.date,
          count: parseInt(r.count),
        })),
        byDoctor: byDoctor.map((r: any) => ({
          practitionerName: r.practitionerName,
          count: parseInt(r.count),
        })),
        demographics: {
          byGender: byGender.map((r: any) => ({
            gender: r.gender,
            count: parseInt(r.count, 10),
          })),
          byAgeGroup,
          newVsReturning,
        },
        procedureMix: {
          topProcedures,
          byKategori,
          avgProceduresPerVisit,
        },
        byHour,
        byDayOfWeek,
        comparison: {
          previousTotal,
          changePercent,
        },
        encounters: encounters.map((e) => ({
          encounterId: e.id,
          date: e.arrivedTime?.toISOString().split('T')[0],
          patientName: (e as any).patient?.name,
          practitionerName: (e as any).practitioner?.name,
          status: e.status,
          durationMinutes:
            e.finishedTime && e.inProgressTime
              ? Math.round(
                  (e.finishedTime.getTime() - e.inProgressTime.getTime()) /
                    60000,
                )
              : null,
        })),
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFinancialReport(clinicId: number, query: FinancialReportQueryDto) {
    const [summaryRow] = await this.billingRepo.query(
      `SELECT
         SUM(grand_total) AS totalBilling,
         SUM(paid_amount) AS totalPaid,
         SUM(outstanding_amount) AS totalOutstanding,
         SUM(CASE WHEN status = 'refunded' THEN paid_amount ELSE 0 END) AS totalRefunded,
         COUNT(*) AS totalBillings
       FROM billings
       WHERE clinic_id = ? AND DATE(created_at) BETWEEN ? AND ?
         AND status != 'cancelled'`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const totalPaid = parseFloat(summaryRow.totalPaid || 0);
    const totalBilling = parseFloat(summaryRow.totalBilling || 0);

    const byDay = await this.billingRepo.query(
      `SELECT DATE(b.created_at) AS date,
         SUM(b.grand_total) AS revenue,
         SUM(p.amount) AS collected
       FROM billings b
       LEFT JOIN payments p ON b.id = p.billing_id
       WHERE b.clinic_id = ? AND DATE(b.created_at) BETWEEN ? AND ?
       GROUP BY DATE(b.created_at)
       ORDER BY date ASC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byPaymentMethod = await this.paymentRepo.query(
      `SELECT p.method, SUM(p.amount) AS amount
       FROM payments p JOIN billings b ON p.billing_id = b.id
       WHERE b.clinic_id = ? AND DATE(p.paid_at) BETWEEN ? AND ?
       GROUP BY p.method`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byDoctorRevenue = await this.billingRepo.query(
      `SELECT pr.id AS practitionerId, pr.name AS practitionerName, SUM(b.grand_total) AS revenue
       FROM billings b
       JOIN encounters e ON b.encounter_id = e.id
       JOIN practitioners pr ON e.practitioner_id = pr.id
       WHERE b.clinic_id = ? AND DATE(b.created_at) BETWEEN ? AND ?
         AND b.status != 'cancelled'
       GROUP BY pr.id, pr.name
       ORDER BY revenue DESC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const shareRows = await this.billingItemRepo.query(
      `SELECT
         pr.id AS practitionerId,
         t.id AS tarifId,
         t.harga_jual AS hargaJual,
         SUM(bi.quantity) AS count,
         dfc.fee_type AS feeType,
         dfc.fee_value AS feeValue
       FROM billing_items bi
       JOIN billings b ON bi.billing_id = b.id
       JOIN encounters e ON b.encounter_id = e.id
       JOIN practitioners pr ON e.practitioner_id = pr.id
       JOIN tarifs t ON bi.tarif_id = t.id
       LEFT JOIN doctor_fee_configs dfc
         ON dfc.tarif_id = t.id AND dfc.clinic_id = b.clinic_id
       WHERE b.clinic_id = ? AND DATE(b.created_at) BETWEEN ? AND ?
         AND b.status != 'cancelled'
       GROUP BY pr.id, t.id, t.harga_jual, dfc.fee_type, dfc.fee_value`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const shareByPractitioner = new Map<number, number>();
    for (const row of shareRows as any[]) {
      const count = parseInt(row.count, 10);
      const hargaJual = parseFloat(row.hargaJual || 0);
      const feeType: FeeType = row.feeType || FeeType.PERCENTAGE;
      const feeValue = parseFloat(row.feeValue || 0);
      const totalShare =
        feeType === FeeType.FIXED
          ? count * feeValue
          : count * (hargaJual * (feeValue / 100));
      shareByPractitioner.set(
        row.practitionerId,
        (shareByPractitioner.get(row.practitionerId) || 0) + totalShare,
      );
    }

    const byDoctor = byDoctorRevenue.map((r: any) => ({
      practitionerName: r.practitionerName,
      revenue: parseFloat(r.revenue || 0),
      doctorFeeShare: shareByPractitioner.get(r.practitionerId) || 0,
    }));

    const tindakanRows = await this.billingItemRepo.query(
      `SELECT
         t.id AS tarifId,
         t.name AS tarifName,
         t.harga_pokok AS hargaPokok,
         t.harga_jual AS hargaJual,
         SUM(bi.quantity) AS frekuensi,
         SUM(bi.discount) AS totalDiskon,
         SUM(bi.subtotal) AS totalSubtotal
       FROM billing_items bi
       JOIN billings b ON bi.billing_id = b.id
       JOIN tarifs t ON bi.tarif_id = t.id
       WHERE b.clinic_id = ? AND DATE(b.created_at) BETWEEN ? AND ?
         AND b.status != 'cancelled'
       GROUP BY t.id, t.name, t.harga_pokok, t.harga_jual
       ORDER BY frekuensi DESC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const tindakanTerlaris = tindakanRows.map((r: any) => {
      const frekuensi = parseInt(r.frekuensi, 10);
      const hargaPokok = parseFloat(r.hargaPokok || 0);
      const hargaJual = parseFloat(r.hargaJual || 0);
      const totalDiskon = parseFloat(r.totalDiskon || 0);
      const totalSubtotal = parseFloat(r.totalSubtotal || 0);
      const modal = hargaPokok * frekuensi;
      return {
        tarifId: r.tarifId,
        namaTindakan: r.tarifName,
        modal,
        hargaJual,
        frekuensi,
        totalDiskon,
        labaBersih: totalSubtotal - modal,
      };
    });

    const totalModal = tindakanTerlaris.reduce((sum, t) => sum + t.modal, 0);

    const [pengeluaranRow] = await this.operationalRecordRepo.query(
      `SELECT SUM(nominal) AS total FROM operational_records
       WHERE clinic_id = ? AND tanggal BETWEEN ? AND ?`,
      [clinicId, query.dateFrom, query.dateTo],
    );
    const totalPengeluaran = parseFloat(pengeluaranRow?.total || 0);

    const labaBersih = totalPaid - totalModal - totalPengeluaran;
    const marginPersen =
      totalPaid > 0
        ? parseFloat(((labaBersih / totalPaid) * 100).toFixed(1))
        : 0;

    return {
      data: {
        summary: {
          totalBilling: totalBilling,
          totalPaid: totalPaid,
          totalOutstanding: parseFloat(summaryRow.totalOutstanding || 0),
          collectionRate:
            totalBilling > 0
              ? parseFloat(((totalPaid / totalBilling) * 100).toFixed(1))
              : 0,
          totalRefunded: parseFloat(summaryRow.totalRefunded || 0),
        },
        byDay: byDay.map((r: any) => ({
          date: r.date,
          revenue: parseFloat(r.revenue || 0),
          collected: parseFloat(r.collected || 0),
        })),
        byPaymentMethod: byPaymentMethod.map((r: any) => ({
          method: r.method,
          amount: parseFloat(r.amount || 0),
        })),
        byDoctor,
        ringkasan: {
          pendapatanTotal: totalPaid,
          modal: totalModal,
          labaBersih,
          pengeluaran: totalPengeluaran,
          marginPersen,
        },
        tindakanTerlaris,
      },
    };
  }

  async getFinancialVisitDetail(
    clinicId: number,
    query: FinancialVisitDetailQueryDto,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const rows = await this.encounterRepo.query(
      `SELECT
         e.id AS encounterId,
         p.name AS patientName,
         p.birth_date AS birthDate,
         GROUP_CONCAT(DISTINCT bi.name SEPARATOR ', ') AS tindakan,
         e.arrived_time AS jamMasuk,
         e.finished_time AS jamKeluar
       FROM encounters e
       JOIN patients p ON e.patient_id = p.id
       LEFT JOIN billings b ON b.encounter_id = e.id AND b.status != 'cancelled'
       LEFT JOIN billing_items bi ON bi.billing_id = b.id
       WHERE e.clinic_id = ? AND DATE(e.arrived_time) BETWEEN ? AND ?
       GROUP BY e.id, p.name, p.birth_date, e.arrived_time, e.finished_time
       ORDER BY e.arrived_time DESC
       LIMIT ? OFFSET ?`,
      [clinicId, query.dateFrom, query.dateTo, limit, offset],
    );

    const [countRow] = await this.encounterRepo.query(
      `SELECT COUNT(*) AS total FROM encounters e
       WHERE e.clinic_id = ? AND DATE(e.arrived_time) BETWEEN ? AND ?`,
      [clinicId, query.dateFrom, query.dateTo],
    );
    const total = parseInt(countRow?.total || 0, 10);

    return {
      data: {
        data: rows.map((r: any) => ({
          encounterId: r.encounterId,
          patientName: r.patientName,
          birthDate: r.birthDate,
          tindakan: r.tindakan || '-',
          jamMasuk: r.jamMasuk,
          jamKeluar: r.jamKeluar,
        })),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  async getSatusehatSyncReport(
    clinicId: number,
    query: SatusehatSyncReportQueryDto,
  ) {
    const qb = this.syncLogRepo
      .createQueryBuilder('s')
      .where('s.clinicId = :clinicId', { clinicId });

    if (query.dateFrom)
      qb.andWhere('DATE(s.createdAt) >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      qb.andWhere('DATE(s.createdAt) <= :dateTo', { dateTo: query.dateTo });
    if (query.resourceType && query.resourceType !== 'all') {
      qb.andWhere('s.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.syncStatus && query.syncStatus !== 'all') {
      qb.andWhere('s.status = :status', { status: query.syncStatus });
    }

    // Summary
    const [summaryRow] = await this.syncLogRepo.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'success') AS synced,
         SUM(status = 'failed') AS failed,
         SUM(status = 'pending') AS pending
       FROM satusehat_sync_logs
       WHERE clinic_id = ?
       ${query.dateFrom ? 'AND DATE(created_at) >= ?' : ''}
       ${query.dateTo ? 'AND DATE(created_at) <= ?' : ''}`,
      [
        clinicId,
        ...(query.dateFrom ? [query.dateFrom] : []),
        ...(query.dateTo ? [query.dateTo] : []),
      ],
    );

    const total = parseInt(summaryRow.total);
    const synced = parseInt(summaryRow.synced);

    const byResource = await this.syncLogRepo.query(
      `SELECT resource_type AS resourceType,
         SUM(status = 'success') AS synced,
         SUM(status = 'failed') AS failed,
         SUM(status = 'pending') AS pending
       FROM satusehat_sync_logs
       WHERE clinic_id = ?
       GROUP BY resource_type`,
      [clinicId],
    );

    const failedItems = await this.syncLogRepo.find({
      where: { clinicId, status: SyncLogStatus.FAILED },
      order: { createdAt: 'DESC' },
      take: 50,
      select: {
        resourceType: true,
        localId: true,
        errorMessage: true,
        retryCount: true,
        createdAt: true,
      },
    });

    return {
      data: {
        summary: {
          total,
          synced,
          failed: parseInt(summaryRow.failed),
          pending: parseInt(summaryRow.pending),
          syncRate:
            total > 0 ? parseFloat(((synced / total) * 100).toFixed(1)) : 0,
        },
        byResource: byResource.map((r: any) => ({
          resourceType: r.resourceType,
          synced: parseInt(r.synced),
          failed: parseInt(r.failed),
          pending: parseInt(r.pending),
        })),
        failedItems: failedItems.map((f) => ({
          resourceType: f.resourceType,
          localId: f.localId,
          errorMessage: f.errorMessage,
          failedAt: f.createdAt,
          retryCount: f.retryCount,
        })),
      },
    };
  }

  async retrySync(clinicId: number, dto: RetrySyncDto) {
    const qb = this.syncLogRepo
      .createQueryBuilder()
      .update(SatusehatSyncLog)
      .set({ status: SyncLogStatus.PENDING, lastRetryAt: new Date() })
      .where('clinicId = :clinicId AND status = :status', {
        clinicId,
        status: SyncLogStatus.FAILED,
      });

    if (dto.resourceType) {
      qb.andWhere('resourceType = :resourceType', {
        resourceType: dto.resourceType,
      });
    }
    if (dto.localIds && dto.localIds.length > 0) {
      qb.andWhere('localId IN (:...localIds)', { localIds: dto.localIds });
    }

    const result = await qb.execute();
    return {
      queued: result.affected || 0,
      message: 'Proses retry dimulai di background',
    };
  }
}

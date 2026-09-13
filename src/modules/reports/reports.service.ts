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
import { Barang } from '../gudang/entities/barang.entity';
import { StokTransaksi } from '../gudang/entities/stok-transaksi.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PatientOriginGeocode } from './entities/patient-origin-geocode.entity';

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
    @InjectRepository(Barang)
    private readonly barangRepo: Repository<Barang>,
    @InjectRepository(StokTransaksi)
    private readonly stokTransaksiRepo: Repository<StokTransaksi>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(PatientOriginGeocode)
    private readonly patientOriginGeocodeRepo: Repository<PatientOriginGeocode>,
  ) {}

  async getDoctorFeeShareReport(
    clinicId: number,
    query: DoctorFeeShareReportQueryDto,
    practitionerId?: number,
  ) {
    const params: unknown[] = [clinicId, query.year, query.month];
    // Scoping filter for the DOKTER self-service view (see ReportsController) —
    // applied in SQL, not just filtered out of the result, so a doctor's own
    // report never even pulls colleagues' fee rows into memory.
    let practitionerFilter = '';
    if (practitionerId) {
      practitionerFilter = 'AND pr.id = ?';
      params.push(practitionerId);
    }

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
         ${practitionerFilter}
       GROUP BY pr.id, pr.name, t.id, t.name, t.harga_jual, dfc.fee_type, dfc.fee_value
       ORDER BY pr.id ASC`,
      params,
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

    // bi.subtotal is per-item, pre billing-level discount — a billing-level
    // discount/additional fee (billings.total_discount / additional_fee)
    // never lands on any single item, so raw SUM(bi.subtotal) overstates
    // revenue whenever a billing has one. Scale each item by that billing's
    // grand_total/subtotal ratio so tindakan-level totals foot back to the
    // clinic's actual (billing.grand_total-based) revenue.
    const tindakanRows = await this.billingItemRepo.query(
      `SELECT
         t.id AS tarifId,
         t.name AS tarifName,
         t.harga_pokok AS hargaPokok,
         t.harga_jual AS hargaJual,
         SUM(bi.quantity) AS frekuensi,
         SUM(bi.discount) AS totalDiskon,
         SUM(bi.subtotal * (b.grand_total / NULLIF(b.subtotal, 0))) AS totalSubtotal
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

    const [prevSummaryRow] = await this.billingRepo.query(
      `SELECT SUM(paid_amount) AS totalPaid
       FROM billings
       WHERE clinic_id = ? AND DATE(created_at) BETWEEN ? AND ?
         AND status != 'cancelled'`,
      [clinicId, toIso(prevDateFrom), toIso(prevDateTo)],
    );
    const previousPendapatan = parseFloat(prevSummaryRow?.totalPaid || 0);
    const changePercent =
      previousPendapatan > 0
        ? parseFloat(
            (
              ((totalPaid - previousPendapatan) / previousPendapatan) *
              100
            ).toFixed(1),
          )
        : null;

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
        comparison: {
          previousPendapatan,
          changePercent,
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
        businessMetrics: await this.computeBusinessMetrics(
          clinicId,
          query.dateFrom,
          query.dateTo,
        ),
      },
    };
  }

  // ================= Laporan Keuangan Pro (PRD 5.14) =================
  // Konten "Pro" — laporan ke akuntan/investor, laporan stok, dan analitik
  // tambahan — sengaja dipisah dari getFinancialReport (basic) supaya
  // halaman basic tetap ringan dan hanya berisi tabel + export Excel.

  /**
   * Laporan keuangan versi Pro: superset dari basic ditambah laba kotor,
   * tren bulanan (6 bulan), laba bersih per dokter, ranking tindakan
   * paling sering didiskon, heatmap jam kunjungan, dan laporan stok
   * (integrasi Gudang).
   */
  async getFinancialReportPro(
    clinicId: number,
    query: FinancialReportQueryDto,
  ) {
    const base = await this.getFinancialReport(clinicId, query);

    const monthKeys = this.getTrailingMonthKeys(6);
    const [monthlyTrend, byDoctorProfit, visitHeatmap, stockReport] =
      await Promise.all([
        this.computeMonthlyTrend(clinicId, monthKeys),
        this.computeByDoctorProfit(clinicId, query.dateFrom, query.dateTo),
        this.computeVisitHeatmap(clinicId, query.dateFrom, query.dateTo),
        this.computeStockReport(clinicId, query.dateFrom, query.dateTo),
      ]);

    const discountRanking = [...base.data.tindakanTerlaris]
      .filter((t) => t.totalDiskon > 0)
      .sort((a, b) => b.totalDiskon - a.totalDiskon)
      .slice(0, 10);

    const labaKotor = base.data.summary.totalPaid - base.data.ringkasan.modal;

    return {
      data: {
        ...base.data,
        labaKotor,
        monthlyTrend,
        byDoctorProfit,
        discountRanking,
        visitHeatmap,
        stockReport,
      },
    };
  }

  /**
   * Laba bersih per dokter (pendapatan - modal - fee dokter), untuk chart
   * "Revenue per Dokter" di Laporan Keuangan Pro. Terpisah dari byDoctor di
   * getFinancialReport karena butuh modal per tindakan per dokter juga.
   */
  private async computeByDoctorProfit(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
  ) {
    // See tindakanRows above for why bi.subtotal needs prorating by the
    // billing's grand_total/subtotal ratio before it can be summed as
    // "revenue" — otherwise a doctor's total can come out higher than the
    // clinic's actual total revenue whenever billings carry a discount.
    const rows = await this.billingItemRepo.query(
      `SELECT
         pr.id AS practitionerId,
         pr.name AS practitionerName,
         t.harga_pokok AS hargaPokok,
         t.harga_jual AS hargaJual,
         SUM(bi.quantity) AS qty,
         SUM(bi.subtotal * (b.grand_total / NULLIF(b.subtotal, 0))) AS revenue,
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
       GROUP BY pr.id, pr.name, t.id, t.harga_pokok, t.harga_jual, dfc.fee_type, dfc.fee_value`,
      [clinicId, dateFrom, dateTo],
    );

    const byPractitioner = new Map<
      number,
      {
        practitionerName: string;
        revenue: number;
        modal: number;
        feeShare: number;
      }
    >();
    for (const r of rows as any[]) {
      const qty = parseInt(r.qty, 10);
      const revenue = parseFloat(r.revenue || 0);
      const hargaPokok = parseFloat(r.hargaPokok || 0);
      const hargaJual = parseFloat(r.hargaJual || 0);
      const feeType: FeeType = r.feeType || FeeType.PERCENTAGE;
      const feeValue = parseFloat(r.feeValue || 0);
      const modal = hargaPokok * qty;
      const feeShare =
        feeType === FeeType.FIXED
          ? qty * feeValue
          : qty * (hargaJual * (feeValue / 100));

      const existing = byPractitioner.get(r.practitionerId) ?? {
        practitionerName: r.practitionerName,
        revenue: 0,
        modal: 0,
        feeShare: 0,
      };
      existing.revenue += revenue;
      existing.modal += modal;
      existing.feeShare += feeShare;
      byPractitioner.set(r.practitionerId, existing);
    }

    return Array.from(byPractitioner.values())
      .map((d) => ({
        practitionerName: d.practitionerName,
        revenue: d.revenue,
        doctorFeeShare: d.feeShare,
        labaBersih: d.revenue - d.modal - d.feeShare,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /** Jumlah kunjungan per hari-dalam-minggu x jam, untuk heatmap jam tersibuk. */
  private async computeVisitHeatmap(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
  ) {
    const rows = await this.encounterRepo.query(
      `SELECT DAYOFWEEK(arrived_time) AS dayOfWeek, HOUR(arrived_time) AS hour, COUNT(*) AS count
       FROM encounters
       WHERE clinic_id = ? AND DATE(arrived_time) BETWEEN ? AND ?
       GROUP BY dayOfWeek, hour`,
      [clinicId, dateFrom, dateTo],
    );
    return (rows as any[]).map((r) => ({
      dayOfWeek: parseInt(r.dayOfWeek, 10),
      hour: parseInt(r.hour, 10),
      count: parseInt(r.count, 10),
    }));
  }

  /**
   * Laporan Stok (integrasi Gudang) — total nilai inventory saat ini, dan
   * pemakaian bahan (transaksi keluar) pada periode terpilih diurutkan dari
   * biaya tertinggi (sekaligus menjawab "bahan dengan biaya tertinggi").
   */
  private async computeStockReport(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
  ) {
    const [inventoryRow] = await this.barangRepo.query(
      `SELECT SUM(stok_saat_ini * harga_beli) AS totalValue, COUNT(*) AS totalItems
       FROM barang WHERE clinic_id = ? AND is_active = 1`,
      [clinicId],
    );

    const usageRows = await this.stokTransaksiRepo.query(
      `SELECT b.id AS barangId, b.name AS barangName, b.satuan_pakai AS satuan,
         SUM(st.qty) AS qtyUsed,
         SUM(st.qty * COALESCE(st.harga_beli, b.harga_beli)) AS totalCost
       FROM stok_transaksi st
       JOIN barang b ON st.barang_id = b.id
       WHERE st.clinic_id = ? AND st.type = 'out' AND st.tanggal BETWEEN ? AND ?
       GROUP BY b.id, b.name, b.satuan_pakai
       ORDER BY totalCost DESC`,
      [clinicId, dateFrom, dateTo],
    );

    return {
      totalInventoryValue: parseFloat(inventoryRow?.totalValue || 0),
      totalActiveItems: parseInt(inventoryRow?.totalItems || 0, 10),
      usage: (usageRows as any[]).map((r) => ({
        barangId: r.barangId,
        barangName: r.barangName,
        satuan: r.satuan,
        qtyUsed: parseInt(r.qtyUsed, 10),
        totalCost: parseFloat(r.totalCost || 0),
      })),
    };
  }

  /**
   * Geocode satu kecamatan+kota via OpenStreetMap Nominatim (gratis, tanpa
   * API key). Hasil selalu disimpan ke cache (termasuk kalau gagal, dengan
   * resolved=false) supaya kecamatan yang sama tidak pernah di-request ulang
   * ke Nominatim pada request berikutnya.
   */
  private async geocodeKecamatan(
    kecamatan: string,
    city: string,
  ): Promise<PatientOriginGeocode> {
    const existing = await this.patientOriginGeocodeRepo.findOne({
      where: { kecamatan, city },
    });
    if (existing) return existing;

    const record = this.patientOriginGeocodeRepo.create({
      kecamatan,
      city,
      lat: null,
      lng: null,
      resolved: false,
    });

    try {
      const q = encodeURIComponent(`${kecamatan}, ${city}, Indonesia`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
        {
          headers: {
            'User-Agent':
              'ApexRecord-ClinicApp/1.0 (contact: support@apexrecord.my.id)',
          },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (res.ok) {
        const results = (await res.json()) as Array<{
          lat: string;
          lon: string;
        }>;
        if (results.length > 0) {
          record.lat = parseFloat(results[0].lat);
          record.lng = parseFloat(results[0].lon);
          record.resolved = true;
        }
      }
    } catch {
      // Gagal geocode (timeout/network) — biarkan resolved=false, tersimpan
      // di cache supaya tidak dicoba ulang terus setiap laporan dibuka.
    }

    return this.patientOriginGeocodeRepo.save(record);
  }

  /**
   * Sebaran asal pasien per kecamatan, untuk heatmap/bubble map di Laporan
   * Keuangan Pro. Agregasi jumlah pasien dulu dari DB (murah), baru
   * kecamatan yang belum pernah di-geocode di-resolve satu-satu ke Nominatim
   * (dibatasi per request supaya tidak menggantung lama & menghormati rate
   * limit Nominatim yaitu maks 1 request/detik).
   */
  async getPatientOriginMap(clinicId: number) {
    const rows = await this.patientRepo.query(
      `SELECT kecamatan, city, COUNT(*) AS count
       FROM patients
       WHERE clinic_id = ? AND kecamatan IS NOT NULL AND kecamatan != ''
         AND city IS NOT NULL AND city != ''
       GROUP BY kecamatan, city
       ORDER BY count DESC`,
      [clinicId],
    );

    const MAX_GEOCODE_PER_REQUEST = 15;
    let geocodedThisRequest = 0;
    const points: Array<{
      kecamatan: string;
      city: string;
      count: number;
      lat: number | null;
      lng: number | null;
      resolved: boolean;
    }> = [];

    for (const r of rows as Array<{
      kecamatan: string;
      city: string;
      count: string;
    }>) {
      const cached = await this.patientOriginGeocodeRepo.findOne({
        where: { kecamatan: r.kecamatan, city: r.city },
      });

      let geo = cached;
      if (!geo) {
        if (geocodedThisRequest >= MAX_GEOCODE_PER_REQUEST) {
          points.push({
            kecamatan: r.kecamatan,
            city: r.city,
            count: parseInt(r.count, 10),
            lat: null,
            lng: null,
            resolved: false,
          });
          continue;
        }
        if (geocodedThisRequest > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
        }
        geo = await this.geocodeKecamatan(r.kecamatan, r.city);
        geocodedThisRequest += 1;
      }

      points.push({
        kecamatan: r.kecamatan,
        city: r.city,
        count: parseInt(r.count, 10),
        lat: geo.lat !== null ? parseFloat(geo.lat as unknown as string) : null,
        lng: geo.lng !== null ? parseFloat(geo.lng as unknown as string) : null,
        resolved: geo.resolved,
      });
    }

    return { data: points };
  }

  /**
   * Sebaran asal pasien per kelurahan — pelengkap `getPatientOriginMap`
   * (yang berhenti di level kecamatan). Kelurahan jauh lebih kecil/spesifik
   * daripada kecamatan sehingga jarang dikenali Nominatim, jadi di sini kita
   * cuma agregasi jumlah pasien dari DB tanpa mencoba geocode — cukup untuk
   * tabel breakdown, tidak untuk dipetakan.
   */
  async getPatientOriginByKelurahan(clinicId: number) {
    const rows = await this.patientRepo.query(
      `SELECT kelurahan, kecamatan, city, COUNT(*) AS count
       FROM patients
       WHERE clinic_id = ? AND kelurahan IS NOT NULL AND kelurahan != ''
       GROUP BY kelurahan, kecamatan, city
       ORDER BY count DESC`,
      [clinicId],
    );

    return {
      data: (
        rows as Array<{
          kelurahan: string;
          kecamatan: string | null;
          city: string | null;
          count: string;
        }>
      ).map((r) => ({
        kelurahan: r.kelurahan,
        kecamatan: r.kecamatan,
        city: r.city,
        count: parseInt(r.count, 10),
      })),
    };
  }

  // ================= Metrik bisnis & keuangan lanjutan =================
  // Dipakai baik oleh laporan keuangan interaktif (getFinancialReport) maupun
  // laporan investor (getInvestorReportData) supaya definisinya konsisten.

  /**
   * Customer Lifetime Value — rata-rata total pembayaran per pasien
   * SEPANJANG riwayat klinik (all-time), bukan cuma periode yang dipilih,
   * karena LTV secara definisi adalah ukuran seumur hidup pelanggan.
   */
  private async computeLtv(clinicId: number) {
    const [row] = await this.billingRepo.query(
      `SELECT AVG(total) AS avgLtv, AVG(visits) AS avgVisits, COUNT(*) AS patientCount
       FROM (
         SELECT patient_id, SUM(paid_amount) AS total, COUNT(*) AS visits
         FROM billings
         WHERE clinic_id = ? AND status != 'cancelled' AND paid_amount > 0
         GROUP BY patient_id
       ) x`,
      [clinicId],
    );
    return {
      averageLtv: parseFloat(row?.avgLtv || 0),
      averageVisitsPerPatient: row?.avgVisits
        ? parseFloat(parseFloat(row.avgVisits).toFixed(1))
        : 0,
      patientCount: parseInt(row?.patientCount || 0, 10),
    };
  }

  /** Average Revenue Per Visit — rata-rata pendapatan per transaksi pada periode. */
  private async computeArpv(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
  ) {
    const [row] = await this.billingRepo.query(
      `SELECT SUM(paid_amount) AS totalPaid, COUNT(*) AS totalBillings
       FROM billings
       WHERE clinic_id = ? AND DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'`,
      [clinicId, dateFrom, dateTo],
    );
    const totalPaid = parseFloat(row?.totalPaid || 0);
    const totalBillings = parseInt(row?.totalBillings || 0, 10);
    return totalBillings > 0
      ? parseFloat((totalPaid / totalBillings).toFixed(0))
      : 0;
  }

  /**
   * Konsentrasi pendapatan ala Pareto — berapa persen pendapatan periode ini
   * berasal dari 20% pasien dengan pembayaran terbesar. Angka tinggi berarti
   * pendapatan klinik bergantung pada segelintir pasien (risiko konsentrasi).
   */
  private async computeParetoConcentration(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
  ) {
    const rows = await this.billingRepo.query(
      `SELECT patient_id, SUM(paid_amount) AS total
       FROM billings
       WHERE clinic_id = ? AND DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
       GROUP BY patient_id
       HAVING total > 0
       ORDER BY total DESC`,
      [clinicId, dateFrom, dateTo],
    );
    const totals = (rows as any[]).map((r) => parseFloat(r.total));
    const grandTotal = totals.reduce((sum, v) => sum + v, 0);
    if (totals.length === 0 || grandTotal === 0) {
      return { top20PercentPatientShare: 0, patientCount: 0 };
    }
    const top20Count = Math.max(1, Math.ceil(totals.length * 0.2));
    const top20Sum = totals.slice(0, top20Count).reduce((sum, v) => sum + v, 0);
    return {
      top20PercentPatientShare: parseFloat(
        ((top20Sum / grandTotal) * 100).toFixed(1),
      ),
      patientCount: totals.length,
    };
  }

  /**
   * Days Sales Outstanding (proxy) — rata-rata umur (hari) tagihan yang
   * masih outstanding SAAT INI (snapshot, bukan terikat periode terpilih).
   */
  private async computeDso(clinicId: number) {
    const [row] = await this.billingRepo.query(
      `SELECT AVG(DATEDIFF(CURDATE(), created_at)) AS avgAgeDays, COUNT(*) AS count
       FROM billings
       WHERE clinic_id = ? AND status IN ('unpaid', 'partial') AND outstanding_amount > 0`,
      [clinicId],
    );
    return {
      averageDays: row?.avgAgeDays ? Math.round(parseFloat(row.avgAgeDays)) : 0,
      outstandingCount: parseInt(row?.count || 0, 10),
    };
  }

  /**
   * Retention — dari pasien yang membayar pada periode SEBELUMNYA (durasi
   * sama, langsung sebelum dateFrom), berapa persen kembali membayar lagi
   * pada periode ini.
   */
  private async computeRetentionRate(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
  ) {
    const rangeDays =
      Math.round(
        (new Date(`${dateTo}T00:00:00`).getTime() -
          new Date(`${dateFrom}T00:00:00`).getTime()) /
          86400000,
      ) + 1;
    const prevDateTo = new Date(`${dateFrom}T00:00:00`);
    prevDateTo.setDate(prevDateTo.getDate() - 1);
    const prevDateFrom = new Date(prevDateTo);
    prevDateFrom.setDate(prevDateFrom.getDate() - (rangeDays - 1));
    const toIso = (d: Date) => d.toISOString().slice(0, 10);

    const [row] = await this.billingRepo.query(
      `SELECT
         COUNT(DISTINCT prev.patient_id) AS prevPatients,
         COUNT(DISTINCT CASE WHEN cur.patient_id IS NOT NULL THEN prev.patient_id END) AS returningPatients
       FROM (
         SELECT DISTINCT patient_id FROM billings
         WHERE clinic_id = ? AND DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled' AND paid_amount > 0
       ) prev
       LEFT JOIN (
         SELECT DISTINCT patient_id FROM billings
         WHERE clinic_id = ? AND DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled' AND paid_amount > 0
       ) cur ON cur.patient_id = prev.patient_id`,
      [
        clinicId,
        toIso(prevDateFrom),
        toIso(prevDateTo),
        clinicId,
        dateFrom,
        dateTo,
      ],
    );
    const prevPatients = parseInt(row?.prevPatients || 0, 10);
    const returningPatients = parseInt(row?.returningPatients || 0, 10);
    return {
      retentionRatePercent:
        prevPatients > 0
          ? parseFloat(((returningPatients / prevPatients) * 100).toFixed(1))
          : null,
      previousPeriodPatients: prevPatients,
      returningPatients,
    };
  }

  /**
   * Profitabilitas per kategori tindakan pada periode — melengkapi
   * tindakanTerlaris (yang berbasis frekuensi) dengan sudut pandang margin.
   */
  private async computeCategoryProfitability(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
  ) {
    // Same billing-level-discount prorating as tindakanRows/computeByDoctorProfit.
    const rows = await this.billingItemRepo.query(
      `SELECT
         t.kategori AS kategori,
         SUM(bi.quantity) AS frekuensi,
         SUM(bi.subtotal * (b.grand_total / NULLIF(b.subtotal, 0))) AS pendapatan,
         SUM(t.harga_pokok * bi.quantity) AS modal
       FROM billing_items bi
       JOIN billings b ON bi.billing_id = b.id
       JOIN tarifs t ON bi.tarif_id = t.id
       WHERE b.clinic_id = ? AND DATE(b.created_at) BETWEEN ? AND ? AND b.status != 'cancelled'
       GROUP BY t.kategori
       ORDER BY pendapatan DESC`,
      [clinicId, dateFrom, dateTo],
    );
    return (rows as any[]).map((r) => {
      const pendapatan = parseFloat(r.pendapatan || 0);
      const modal = parseFloat(r.modal || 0);
      const labaBersih = pendapatan - modal;
      return {
        kategori: r.kategori || 'Lainnya',
        frekuensi: parseInt(r.frekuensi, 10),
        pendapatan,
        modal,
        labaBersih,
        marginPersen:
          pendapatan > 0
            ? parseFloat(((labaBersih / pendapatan) * 100).toFixed(1))
            : 0,
      };
    });
  }

  /**
   * Customer Acquisition Cost — total biaya iklan klinik (kategori
   * `biaya_iklan` di Catat Operasional) dibagi jumlah pasien BARU pada
   * periode yang sama, plus rasio LTV:CAC (indikator kesehatan akuisisi:
   * >= 3x umumnya dianggap sehat).
   */
  private async computeMarketingMetrics(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
    averageLtv: number,
  ) {
    const [adSpendRow] = await this.operationalRecordRepo.query(
      `SELECT SUM(nominal) AS total FROM operational_records
       WHERE clinic_id = ? AND tanggal BETWEEN ? AND ? AND kategori = 'biaya_iklan'`,
      [clinicId, dateFrom, dateTo],
    );
    const totalAdSpend = parseFloat(adSpendRow?.total || 0);

    const [newPatientsRow] = await this.encounterRepo.query(
      `SELECT COUNT(*) AS count FROM (
         SELECT patient_id, MIN(DATE(arrived_time)) AS firstDate
         FROM encounters WHERE clinic_id = ?
         GROUP BY patient_id
       ) fv
       WHERE fv.firstDate BETWEEN ? AND ?`,
      [clinicId, dateFrom, dateTo],
    );
    const newPatients = parseInt(newPatientsRow?.count || 0, 10);

    // null (bukan 0) kalau belum ada data biaya iklan tercatat — supaya UI
    // tidak salah baca "akuisisi gratis" padahal datanya memang belum diisi.
    const cac =
      totalAdSpend > 0 && newPatients > 0
        ? parseFloat((totalAdSpend / newPatients).toFixed(0))
        : null;
    const ltvCacRatio =
      cac !== null && cac > 0
        ? parseFloat((averageLtv / cac).toFixed(2))
        : null;

    return { totalAdSpend, newPatients, cac, ltvCacRatio };
  }

  /** Membungkus semua metrik bisnis/keuangan lanjutan untuk satu periode. */
  private async computeBusinessMetrics(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
  ) {
    const ltv = await this.computeLtv(clinicId);
    return {
      ltv,
      arpv: await this.computeArpv(clinicId, dateFrom, dateTo),
      pareto: await this.computeParetoConcentration(clinicId, dateFrom, dateTo),
      dso: await this.computeDso(clinicId),
      retention: await this.computeRetentionRate(clinicId, dateFrom, dateTo),
      categoryProfitability: await this.computeCategoryProfitability(
        clinicId,
        dateFrom,
        dateTo,
      ),
      marketing: await this.computeMarketingMetrics(
        clinicId,
        dateFrom,
        dateTo,
        ltv.averageLtv,
      ),
    };
  }

  private getTrailingMonthKeys(monthCount: number): string[] {
    const keys: string[] = [];
    const now = new Date();
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      );
    }
    return keys;
  }

  /**
   * Tren pendapatan/modal/pengeluaran/laba per bulan untuk sekumpulan
   * bulan (monthKeys, format YYYY-MM) — dipakai baik oleh Laporan Investor
   * (trailing 12 bulan) maupun chart "Pendapatan vs Pengeluaran per Bulan"
   * di Laporan Keuangan Pro (trailing 6 bulan), supaya definisinya konsisten.
   */
  private async computeMonthlyTrend(clinicId: number, monthKeys: string[]) {
    const startDate = `${monthKeys[0]}-01`;

    const revenueRows = await this.billingRepo.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(paid_amount) AS revenue
       FROM billings
       WHERE clinic_id = ? AND status != 'cancelled' AND created_at >= ?
       GROUP BY month`,
      [clinicId, startDate],
    );
    const modalRows = await this.billingItemRepo.query(
      `SELECT DATE_FORMAT(b.created_at, '%Y-%m') AS month, SUM(t.harga_pokok * bi.quantity) AS modal
       FROM billing_items bi
       JOIN billings b ON bi.billing_id = b.id
       JOIN tarifs t ON bi.tarif_id = t.id
       WHERE b.clinic_id = ? AND b.status != 'cancelled' AND b.created_at >= ?
       GROUP BY month`,
      [clinicId, startDate],
    );
    const expenseRows = await this.operationalRecordRepo.query(
      `SELECT DATE_FORMAT(tanggal, '%Y-%m') AS month, SUM(nominal) AS expense
       FROM operational_records
       WHERE clinic_id = ? AND tanggal >= ?
       GROUP BY month`,
      [clinicId, startDate],
    );
    const visitRows = await this.encounterRepo.query(
      `SELECT DATE_FORMAT(arrived_time, '%Y-%m') AS month, COUNT(*) AS visits
       FROM encounters
       WHERE clinic_id = ? AND arrived_time >= ?
       GROUP BY month`,
      [clinicId, startDate],
    );
    const newPatientRows = await this.encounterRepo.query(
      `SELECT DATE_FORMAT(fv.firstDate, '%Y-%m') AS month, COUNT(*) AS newPatients
       FROM (
         SELECT patient_id, MIN(arrived_time) AS firstDate
         FROM encounters WHERE clinic_id = ?
         GROUP BY patient_id
       ) fv
       WHERE fv.firstDate >= ?
       GROUP BY month`,
      [clinicId, startDate],
    );

    const findMonth = (rows: any[], month: string, field: string): number => {
      const found = rows.find((r) => r.month === month);
      return found ? parseFloat(found[field] || 0) : 0;
    };

    return monthKeys.map((month) => {
      const revenue = findMonth(revenueRows, month, 'revenue');
      const modal = findMonth(modalRows, month, 'modal');
      const expense = findMonth(expenseRows, month, 'expense');
      const netProfit = revenue - modal - expense;
      return {
        month,
        revenue,
        modal,
        expense,
        netProfit,
        marginPercent:
          revenue > 0
            ? parseFloat(((netProfit / revenue) * 100).toFixed(1))
            : 0,
        visits: Math.round(findMonth(visitRows, month, 'visits')),
        newPatients: Math.round(
          findMonth(newPatientRows, month, 'newPatients'),
        ),
      };
    });
  }

  /**
   * Data untuk Laporan Investor: tren 12 bulan terakhir + unit economics,
   * dipakai untuk render PDF (lihat InvestorReportPdfService). Selalu
   * trailing 12 bulan dari bulan berjalan — tidak terikat filter tanggal
   * halaman laporan keuangan, karena investor melihat tren, bukan snapshot.
   */
  async getInvestorReportData(clinicId: number) {
    const monthKeys = this.getTrailingMonthKeys(12);
    const startDate = `${monthKeys[0]}-01`;
    const dateTo = new Date().toISOString().slice(0, 10);

    const monthly = await this.computeMonthlyTrend(clinicId, monthKeys);

    const totalRevenue12mo = monthly.reduce((sum, m) => sum + m.revenue, 0);
    const totalNetProfit12mo = monthly.reduce((sum, m) => sum + m.netProfit, 0);
    const totalVisits12mo = monthly.reduce((sum, m) => sum + m.visits, 0);
    const totalNewPatients12mo = monthly.reduce(
      (sum, m) => sum + m.newPatients,
      0,
    );
    // A clinic younger than the 12-month window has mostly-empty leading
    // months in `monthly` (no data yet, not zero revenue) — dividing by a
    // flat 12 understates the average for a new clinic. Divide by the
    // number of months that actually have recorded revenue instead.
    const activeMonths12mo = monthly.filter((m) => m.revenue > 0).length || 1;
    const avgMonthlyRevenue = totalRevenue12mo / activeMonths12mo;
    const avgMarginPercent =
      totalRevenue12mo > 0
        ? parseFloat(((totalNetProfit12mo / totalRevenue12mo) * 100).toFixed(1))
        : 0;

    const last3 = monthly.slice(-3).reduce((sum, m) => sum + m.revenue, 0);
    const prior3 = monthly.slice(-6, -3).reduce((sum, m) => sum + m.revenue, 0);
    const recentGrowthPercent =
      prior3 > 0
        ? parseFloat((((last3 - prior3) / prior3) * 100).toFixed(1))
        : null;

    const [totalPatientsRow] = await this.encounterRepo.query(
      `SELECT COUNT(DISTINCT patient_id) AS total FROM encounters WHERE clinic_id = ? AND arrived_time >= ?`,
      [clinicId, startDate],
    );

    const midDate = `${monthKeys[6]}-01`;
    const [halfYearRetentionRow] = await this.billingRepo.query(
      `SELECT
         COUNT(DISTINCT prev.patient_id) AS prevPatients,
         COUNT(DISTINCT CASE WHEN cur.patient_id IS NOT NULL THEN prev.patient_id END) AS returningPatients
       FROM (
         SELECT DISTINCT patient_id FROM billings
         WHERE clinic_id = ? AND status != 'cancelled' AND paid_amount > 0 AND created_at >= ? AND created_at < ?
       ) prev
       LEFT JOIN (
         SELECT DISTINCT patient_id FROM billings
         WHERE clinic_id = ? AND status != 'cancelled' AND paid_amount > 0 AND created_at >= ?
       ) cur ON cur.patient_id = prev.patient_id`,
      [clinicId, startDate, midDate, clinicId, midDate],
    );
    const prevHalfPatients = parseInt(
      halfYearRetentionRow?.prevPatients || 0,
      10,
    );
    const returningHalfPatients = parseInt(
      halfYearRetentionRow?.returningPatients || 0,
      10,
    );

    const byDoctorRevenue = await this.billingRepo.query(
      `SELECT pr.id AS practitionerId, pr.name AS practitionerName, SUM(b.grand_total) AS revenue
       FROM billings b
       JOIN encounters e ON b.encounter_id = e.id
       JOIN practitioners pr ON e.practitioner_id = pr.id
       WHERE b.clinic_id = ? AND b.created_at >= ? AND b.status != 'cancelled'
       GROUP BY pr.id, pr.name
       ORDER BY revenue DESC`,
      [clinicId, startDate],
    );

    const ltv = await this.computeLtv(clinicId);
    const dso = await this.computeDso(clinicId);
    const arpv = await this.computeArpv(clinicId, startDate, dateTo);
    const categoryProfitability = await this.computeCategoryProfitability(
      clinicId,
      startDate,
      dateTo,
    );
    const marketing = await this.computeMarketingMetrics(
      clinicId,
      startDate,
      dateTo,
      ltv.averageLtv,
    );

    return {
      periodStart: monthKeys[0],
      periodEnd: monthKeys[11],
      generatedAt: new Date().toISOString(),
      monthly,
      summary: {
        totalRevenue12mo,
        totalNetProfit12mo,
        avgMonthlyRevenue,
        activeMonths12mo,
        avgMarginPercent,
        totalVisits12mo,
        totalNewPatients12mo,
        totalPatients12mo: parseInt(totalPatientsRow?.total || 0, 10),
        recentGrowthPercent,
      },
      unitEconomics: {
        ltv,
        arpv,
        dso,
        marketing,
        halfYearRetentionPercent:
          prevHalfPatients > 0
            ? parseFloat(
                ((returningHalfPatients / prevHalfPatients) * 100).toFixed(1),
              )
            : null,
      },
      categoryProfitability,
      byDoctor: (byDoctorRevenue as any[]).map((r) => ({
        practitionerName: r.practitionerName,
        revenue: parseFloat(r.revenue || 0),
      })),
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

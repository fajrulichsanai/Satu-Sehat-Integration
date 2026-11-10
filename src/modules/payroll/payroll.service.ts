import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { OperationalRecord } from '../operational-records/entities/operational-record.entity';
import { ReportsService } from '../reports/reports.service';
import { AttendanceService } from '../attendance/attendance.service';
import { STAFF_ROLES } from '../attendance/attendance-config.service';
import {
  EmployeeSalary,
  PayrollAttendance,
  PayrollItem,
  PayrollRun,
} from './entities/payroll.entity';
import {
  PERIOD_PATTERN,
  PayPayrollDto,
  UpdatePayrollItemDto,
  UpsertSalaryDto,
} from './dto/payroll.dto';

export const itemTotal = (i: {
  baseSalary: number;
  bonus: number;
  deduction: number;
  shareFee: number;
}) =>
  Number(i.baseSalary) +
  Number(i.bonus) +
  Number(i.shareFee) -
  Number(i.deduction);

/** Bagian yang dicatat sebagai pengeluaran "gaji" — share fee dokter sudah dihitung terpisah di laporan. */
export const itemGaji = (i: {
  baseSalary: number;
  bonus: number;
  deduction: number;
}) => Number(i.baseSalary) + Number(i.bonus) - Number(i.deduction);

/**
 * Payroll bulanan: gaji pokok flat + bonus (owner) - potongan + share fee
 * dokter (dari transaksi, sudah dipotong biaya lab). Rekap absensi hanya
 * informasi — tidak memotong gaji otomatis.
 */
@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(EmployeeSalary)
    private readonly salaryRepo: Repository<EmployeeSalary>,
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
    @InjectRepository(PayrollItem)
    private readonly itemRepo: Repository<PayrollItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly reportsService: ReportsService,
    private readonly attendanceService: AttendanceService,
    private readonly dataSource: DataSource,
  ) {}

  private assertPeriod(period: string) {
    if (!PERIOD_PATTERN.test(period)) {
      throw new BadRequestException('Periode harus berformat YYYY-MM');
    }
  }

  private staff(clinicId: number) {
    return this.userRepo.find({
      where: { clinicId, role: In(STAFF_ROLES), isActive: true },
      order: { name: 'ASC' },
    });
  }

  async listEmployees(clinicId: number) {
    const [staff, salaries] = await Promise.all([
      this.staff(clinicId),
      this.salaryRepo.find({ where: { clinicId } }),
    ]);
    const byUser = new Map(salaries.map((s) => [s.userId, s]));
    return staff.map((u) => {
      const s = byUser.get(u.id);
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        isDoctor: !!u.practitionerId,
        baseSalary: s?.baseSalary ?? 0,
        bankName: s?.bankName ?? null,
        bankAccount: s?.bankAccount ?? null,
        bankHolder: s?.bankHolder ?? null,
      };
    });
  }

  async upsertSalary(clinicId: number, userId: number, dto: UpsertSalaryDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId, clinicId },
    });
    if (!user || !STAFF_ROLES.includes(user.role)) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }
    const existing =
      (await this.salaryRepo.findOne({ where: { clinicId, userId } })) ??
      this.salaryRepo.create({ clinicId, userId, baseSalary: 0 });
    if (dto.baseSalary !== undefined) existing.baseSalary = dto.baseSalary;
    if (dto.bankName !== undefined)
      existing.bankName = dto.bankName.trim() || null;
    if (dto.bankAccount !== undefined)
      existing.bankAccount = dto.bankAccount.trim() || null;
    if (dto.bankHolder !== undefined)
      existing.bankHolder = dto.bankHolder.trim() || null;
    return this.salaryRepo.save(existing);
  }

  async listRuns(clinicId: number) {
    const runs = await this.runRepo.find({
      where: { clinicId },
      order: { period: 'DESC' },
    });
    if (!runs.length) return [];
    const items = await this.itemRepo.find({
      where: { runId: In(runs.map((r) => r.id)) },
    });
    return runs.map((r) => {
      const own = items.filter((i) => i.runId === r.id);
      return {
        ...r,
        employees: own.length,
        total: own.reduce((s, i) => s + itemTotal(i), 0),
      };
    });
  }

  /** Detail periode; bila belum dibuat, kembalikan pratinjau hitungan otomatis. */
  async getRun(clinicId: number, period: string) {
    this.assertPeriod(period);
    const run = await this.runRepo.findOne({ where: { clinicId, period } });
    const items = run
      ? await this.itemRepo.find({
          where: { runId: run.id },
          order: { name: 'ASC' },
        })
      : await this.computeItems(clinicId, period);
    return this.present(clinicId, run, period, items);
  }

  /** Buat / hitung ulang draft: gaji pokok, share fee & absensi diperbarui; bonus, potongan, catatan dipertahankan. */
  async generate(clinicId: number, period: string, actorId: number) {
    this.assertPeriod(period);
    let run = await this.runRepo.findOne({ where: { clinicId, period } });
    if (run?.status === 'paid') {
      throw new ConflictException('Payroll periode ini sudah dibayar');
    }
    const computed = await this.computeItems(clinicId, period);
    await this.dataSource.transaction(async (m) => {
      if (!run) {
        run = await m.save(
          m.create(PayrollRun, {
            clinicId,
            period,
            status: 'draft',
            createdBy: actorId,
          }),
        );
      }
      const existing = await m.find(PayrollItem, { where: { runId: run.id } });
      const prev = new Map(existing.map((i) => [i.userId, i]));
      const keep = new Set(computed.map((c) => c.userId));
      const stale = existing.filter((i) => !keep.has(i.userId));
      if (stale.length)
        await m.delete(
          PayrollItem,
          stale.map((i) => i.id),
        );
      for (const c of computed) {
        const old = prev.get(c.userId);
        await m.save(
          m.create(PayrollItem, {
            ...c,
            id: old?.id,
            runId: run.id,
            bonus: old?.bonus ?? 0,
            deduction: old?.deduction ?? 0,
            note: old?.note ?? null,
          }),
        );
      }
    });
    return this.getRun(clinicId, period);
  }

  async updateItem(
    clinicId: number,
    period: string,
    itemId: number,
    dto: UpdatePayrollItemDto,
  ) {
    const run = await this.draftRun(clinicId, period);
    const item = await this.itemRepo.findOne({
      where: { id: itemId, runId: run.id },
    });
    if (!item) throw new NotFoundException('Baris gaji tidak ditemukan');
    if (dto.bonus !== undefined) item.bonus = dto.bonus;
    if (dto.deduction !== undefined) item.deduction = dto.deduction;
    if (dto.note !== undefined) item.note = dto.note.trim() || null;
    if (itemTotal(item) < 0) {
      throw new BadRequestException('Potongan melebihi total gaji');
    }
    await this.itemRepo.save(item);
    return this.getRun(clinicId, period);
  }

  /** Tandai dibayar: kunci periode & catat pengeluaran "gaji" (pokok + bonus - potongan). */
  async markPaid(
    clinicId: number,
    period: string,
    actorId: number,
    dto: PayPayrollDto,
  ) {
    const run = await this.draftRun(clinicId, period);
    const items = await this.itemRepo.find({ where: { runId: run.id } });
    if (!items.length)
      throw new BadRequestException('Belum ada pegawai di payroll ini');
    const gaji = items.reduce((s, i) => s + itemGaji(i), 0);
    const tanggal = dto.tanggal ?? new Date().toISOString().slice(0, 10);
    await this.dataSource.transaction(async (m) => {
      let recordId: number | null = null;
      if (gaji > 0) {
        const rec = await m.save(
          m.create(OperationalRecord, {
            clinicId,
            tanggal,
            kategori: 'gaji',
            deskripsi: `Gaji pegawai periode ${period} (${items.length} orang, tanpa share fee dokter)`,
            nominal: gaji,
            createdBy: actorId,
          }),
        );
        recordId = rec.id;
      }
      await m.update(PayrollRun, run.id, {
        status: 'paid',
        paidAt: new Date(`${tanggal}T12:00:00`),
        operationalRecordId: recordId,
      });
    });
    return this.getRun(clinicId, period);
  }

  /** Batalkan status dibayar (mis. salah input): hapus catatan pengeluaran gaji terkait. */
  async reopen(clinicId: number, period: string) {
    this.assertPeriod(period);
    const run = await this.runRepo.findOne({ where: { clinicId, period } });
    if (!run) throw new NotFoundException('Payroll periode ini belum dibuat');
    if (run.status !== 'paid') return this.getRun(clinicId, period);
    await this.dataSource.transaction(async (m) => {
      if (run.operationalRecordId) {
        await m.delete(OperationalRecord, {
          id: run.operationalRecordId,
          clinicId,
        });
      }
      await m.update(PayrollRun, run.id, {
        status: 'draft',
        paidAt: null,
        operationalRecordId: null,
      });
    });
    return this.getRun(clinicId, period);
  }

  private async draftRun(clinicId: number, period: string) {
    this.assertPeriod(period);
    const run = await this.runRepo.findOne({ where: { clinicId, period } });
    if (!run) throw new NotFoundException('Payroll periode ini belum dibuat');
    if (run.status === 'paid') {
      throw new ConflictException(
        'Payroll periode ini sudah dibayar — batalkan status dibayar dulu untuk mengubah',
      );
    }
    return run;
  }

  private async computeItems(clinicId: number, period: string) {
    const [year, month] = period.split('-').map(Number);
    const [staff, salaries, share, recap] = await Promise.all([
      this.staff(clinicId),
      this.salaryRepo.find({ where: { clinicId } }),
      this.reportsService.getDoctorFeeShareReport(clinicId, { year, month }),
      this.attendanceService.recap(clinicId, period),
    ]);
    const salaryBy = new Map(salaries.map((s) => [s.userId, s]));
    const shareBy = new Map(
      share.data.map((d) => [d.practitionerId, Math.round(d.totalShareFee)]),
    );
    const recapBy = new Map(recap.rows.map((r) => [r.userId, r]));
    return staff.map((u) => {
      const r = recapBy.get(u.id);
      const attendance: PayrollAttendance | null = r
        ? {
            workDays: r.workDays,
            presentDays: r.presentDays,
            lateCount: r.lateCount,
            lateMinutes: r.lateMinutes,
            absentDays: r.absentDays,
          }
        : null;
      return {
        clinicId,
        userId: u.id,
        name: u.name,
        role: u.role,
        baseSalary: salaryBy.get(u.id)?.baseSalary ?? 0,
        shareFee: u.practitionerId ? (shareBy.get(u.practitionerId) ?? 0) : 0,
        bonus: 0,
        deduction: 0,
        note: null as string | null,
        attendance,
      };
    });
  }

  private async present(
    clinicId: number,
    run: PayrollRun | null,
    period: string,
    items: Array<
      Pick<
        PayrollItem,
        | 'userId'
        | 'name'
        | 'role'
        | 'baseSalary'
        | 'bonus'
        | 'deduction'
        | 'shareFee'
        | 'attendance'
        | 'note'
      > & { id?: number }
    >,
  ) {
    const salaries = await this.salaryRepo.find({ where: { clinicId } });
    const bank = new Map(salaries.map((s) => [s.userId, s]));
    const rows = items.map((i) => {
      const s = bank.get(i.userId);
      return {
        id: i.id ?? null,
        userId: i.userId,
        name: i.name,
        role: i.role,
        baseSalary: Number(i.baseSalary),
        bonus: Number(i.bonus),
        deduction: Number(i.deduction),
        shareFee: Number(i.shareFee),
        total: itemTotal(i),
        attendance: i.attendance,
        note: i.note,
        bankName: s?.bankName ?? null,
        bankAccount: s?.bankAccount ?? null,
        bankHolder: s?.bankHolder ?? null,
      };
    });
    const sum = (
      k: 'baseSalary' | 'bonus' | 'deduction' | 'shareFee' | 'total',
    ) => rows.reduce((acc, r) => acc + r[k], 0);
    return {
      period,
      run: run
        ? {
            id: run.id,
            status: run.status,
            paidAt: run.paidAt,
            createdAt: run.createdAt,
          }
        : null,
      items: rows,
      totals: {
        baseSalary: sum('baseSalary'),
        bonus: sum('bonus'),
        deduction: sum('deduction'),
        shareFee: sum('shareFee'),
        total: sum('total'),
      },
    };
  }

  /** Data untuk PDF (slip / rekap). Hanya periode yang sudah dibuat. */
  async runForPdf(clinicId: number, period: string) {
    this.assertPeriod(period);
    const run = await this.runRepo.findOne({ where: { clinicId, period } });
    if (!run) throw new NotFoundException('Payroll periode ini belum dibuat');
    return this.getRun(clinicId, period);
  }
}

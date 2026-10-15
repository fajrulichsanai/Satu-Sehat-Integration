import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { PayrollService } from './payroll.service';
import {
  MUTED,
  Node,
  header,
  kpis,
  periodeLabel,
  render,
  rp,
  section,
  table,
  tanggalPanjang,
} from '../../common/pdf/report-kit';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  dokter: 'Dokter',
  perawat: 'Perawat',
};

type PayrollView = Awaited<ReturnType<PayrollService['getRun']>>;
type Row = PayrollView['items'][number];

@Injectable()
export class PayrollPdfService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    private readonly payroll: PayrollService,
  ) {}

  private stamp() {
    return `Dibuat oleh ApexRecord · ${tanggalPanjang(new Date())}`;
  }

  /** Rekap transfer: siapa dibayar berapa, ke rekening mana. */
  async recap(clinicId: number, period: string): Promise<Buffer> {
    const [clinic, view] = await Promise.all([
      this.clinicRepo.findOne({ where: { id: clinicId } }),
      this.payroll.runForPdf(clinicId, period),
    ]);
    const status =
      view.run?.status === 'paid'
        ? `Dibayar ${view.run.paidAt ? tanggalPanjang(view.run.paidAt) : ''}`
        : 'Draft — belum dibayar';
    const content: Node[] = [
      ...header(
        clinic,
        'Rekap Gaji',
        `Periode ${periodeLabel(period)} · ${status}`,
        true,
      ),
      kpis([
        { label: 'Total dibayarkan', value: rp(view.totals.total) },
        {
          label: 'Gaji pokok + bonus − potongan',
          value: rp(
            view.totals.baseSalary + view.totals.bonus - view.totals.deduction,
          ),
        },
        { label: 'Share fee dokter', value: rp(view.totals.shareFee) },
        { label: 'Pegawai', value: String(view.items.length) },
      ]),
      section(
        'Daftar transfer',
        'Urut nama. Nominal = gaji pokok + bonus + share fee − potongan.',
      ),
      table(
        [
          { text: 'No', width: 18 },
          { text: 'Nama' },
          { text: 'Jabatan', width: 'auto' },
          { text: 'Bank / No. Rekening', width: 'auto' },
          { text: 'Gaji Pokok', right: true },
          { text: 'Bonus', right: true },
          { text: 'Share Fee', right: true },
          { text: 'Potongan', right: true },
          { text: 'Ditransfer', right: true },
        ],
        view.items.map((r, i) => [
          String(i + 1),
          r.name,
          ROLE_LABEL[r.role] ?? r.role,
          r.bankAccount
            ? {
                stack: [
                  `${r.bankName ?? ''} ${r.bankAccount}`.trim(),
                  {
                    text: r.bankHolder ? `a.n. ${r.bankHolder}` : '',
                    color: MUTED,
                    fontSize: 7.5,
                  },
                ],
              }
            : { text: 'Rekening belum diisi', color: MUTED, italics: true },
          rp(r.baseSalary),
          rp(r.bonus),
          rp(r.shareFee),
          r.deduction ? `(${rp(r.deduction)})` : '-',
          { text: rp(r.total), bold: true },
        ]),
        {
          total: [
            '',
            'Total',
            '',
            '',
            rp(view.totals.baseSalary),
            rp(view.totals.bonus),
            rp(view.totals.shareFee),
            view.totals.deduction ? `(${rp(view.totals.deduction)})` : '-',
            rp(view.totals.total),
          ],
          empty: 'Belum ada pegawai',
        },
      ),
      section('Rekap kehadiran (informasi, tidak memotong gaji)'),
      table(
        [
          { text: 'Nama' },
          { text: 'Hari kerja', right: true },
          { text: 'Hadir', right: true },
          { text: 'Terlambat', right: true },
          { text: 'Tidak hadir', right: true },
        ],
        view.items.map((r) => [
          r.name,
          String(r.attendance?.workDays ?? '-'),
          String(r.attendance?.presentDays ?? '-'),
          r.attendance
            ? `${r.attendance.lateCount}× (${r.attendance.lateMinutes} mnt)`
            : '-',
          String(r.attendance?.absentDays ?? '-'),
        ]),
      ),
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 180,
            stack: [
              {
                text: `${clinic?.city || ''}${clinic?.city ? ', ' : ''}${tanggalPanjang(new Date())}`,
                fontSize: 9,
                alignment: 'center',
              },
              {
                text: 'Disetujui oleh,',
                fontSize: 9,
                alignment: 'center',
                margin: [0, 2, 0, 44],
              },
              { text: '( Owner )', fontSize: 9, alignment: 'center' },
            ],
          },
        ],
        margin: [0, 24, 0, 0],
        unbreakable: true,
      },
    ];
    return render(content, this.stamp(), true);
  }

  /** Slip gaji satu pegawai. */
  async slip(
    clinicId: number,
    period: string,
    userId: number,
  ): Promise<Buffer> {
    const [clinic, view] = await Promise.all([
      this.clinicRepo.findOne({ where: { id: clinicId } }),
      this.payroll.runForPdf(clinicId, period),
    ]);
    const r: Row | undefined = view.items.find((i) => i.userId === userId);
    if (!r) throw new NotFoundException('Pegawai tidak ada di payroll ini');
    const line = (label: string, value: string, bold = false): Node[] => [
      { text: label, fontSize: 9.5, bold },
      { text: value, fontSize: 9.5, bold, alignment: 'right' },
    ];
    const content: Node[] = [
      ...header(clinic, 'Slip Gaji', `Periode ${periodeLabel(period)}`),
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Nama', fontSize: 8, color: MUTED },
              { text: r.name, fontSize: 11, bold: true },
              { text: ROLE_LABEL[r.role] ?? r.role, fontSize: 9, color: MUTED },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'Rekening', fontSize: 8, color: MUTED },
              {
                text: r.bankAccount
                  ? `${r.bankName ?? ''} ${r.bankAccount}`.trim()
                  : '-',
                fontSize: 10,
              },
              {
                text: r.bankHolder ? `a.n. ${r.bankHolder}` : '',
                fontSize: 9,
                color: MUTED,
              },
            ],
          },
          {
            width: 'auto',
            stack: [
              { text: 'Status', fontSize: 8, color: MUTED, alignment: 'right' },
              {
                text: view.run?.status === 'paid' ? 'DIBAYAR' : 'DRAFT',
                fontSize: 10,
                bold: true,
                alignment: 'right',
              },
              {
                text: view.run?.paidAt ? tanggalPanjang(view.run.paidAt) : '',
                fontSize: 9,
                color: MUTED,
                alignment: 'right',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 14],
      },
      section('Penerimaan'),
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            line('Gaji pokok', rp(r.baseSalary)),
            line('Bonus', rp(r.bonus)),
            ...(r.shareFee
              ? [
                  line(
                    'Share fee tindakan (sudah dipotong biaya lab)',
                    rp(r.shareFee),
                  ),
                ]
              : []),
            line(
              'Total penerimaan',
              rp(r.baseSalary + r.bonus + r.shareFee),
              true,
            ),
          ],
        },
        layout: 'lightHorizontalLines',
      },
      section('Potongan'),
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            line(
              r.note ? `Potongan (${r.note})` : 'Potongan',
              r.deduction ? `(${rp(r.deduction)})` : '-',
            ),
          ],
        },
        layout: 'lightHorizontalLines',
      },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              {
                text: 'GAJI BERSIH DITERIMA',
                bold: true,
                fontSize: 11,
                color: '#FFFFFF',
                fillColor: '#1A2340',
                margin: [6, 6, 0, 6],
              },
              {
                text: rp(r.total),
                bold: true,
                fontSize: 12,
                color: '#FFFFFF',
                fillColor: '#1A2340',
                alignment: 'right',
                margin: [0, 6, 6, 6],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 14, 0, 0],
      },
      r.attendance
        ? {
            text: `Kehadiran: ${r.attendance.presentDays} dari ${r.attendance.workDays} hari kerja · terlambat ${r.attendance.lateCount}× · tidak hadir ${r.attendance.absentDays} hari (informasi).`,
            fontSize: 8.5,
            color: MUTED,
            margin: [0, 10, 0, 0],
          }
        : '',
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: 'Penerima,',
                fontSize: 9,
                alignment: 'center',
                margin: [0, 0, 0, 44],
              },
              { text: `( ${r.name} )`, fontSize: 9, alignment: 'center' },
            ],
          },
          {
            width: '*',
            stack: [
              {
                text: 'Klinik,',
                fontSize: 9,
                alignment: 'center',
                margin: [0, 0, 0, 44],
              },
              { text: '( Owner )', fontSize: 9, alignment: 'center' },
            ],
          },
        ],
        margin: [0, 30, 0, 0],
        unbreakable: true,
      },
    ];
    return render(content, this.stamp());
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { PhysicalExamination } from '../physical-examination/entities/physical-examination.entity';
// pdfmake's server build exports one process-wide singleton configured via
// setters (see invoice.service.ts for the original setup). Node caches this
// module, so this top-level call runs once per process regardless of how
// many places import it — calling the same setters again from another
// module is harmless (same values), matching invoice.service.ts's pattern.
import PdfMake = require('pdfmake');

const ROBOTO_DIR = path.join(
  require.resolve('pdfmake/package.json'),
  '..',
  'fonts',
  'Roboto',
);
PdfMake.setFonts({
  Roboto: {
    normal: path.join(ROBOTO_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(ROBOTO_DIR, 'Roboto-Medium.ttf'),
    italics: path.join(ROBOTO_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(ROBOTO_DIR, 'Roboto-MediumItalic.ttf'),
  },
});
PdfMake.setLocalAccessPolicy(() => true);
PdfMake.setUrlAccessPolicy(() => false);

function calculateAge(birthDate?: Date | string | null): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

@Injectable()
export class PrescriptionPdfService {
  constructor(
    @InjectRepository(PrescriptionItem)
    private readonly itemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    @InjectRepository(PhysicalExamination)
    private readonly examRepository: Repository<PhysicalExamination>,
  ) {}

  async generatePrescriptionPdf(
    encounterId: number,
    clinicId: number,
  ): Promise<Buffer> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, clinicId },
      relations: { patient: true, practitioner: true, clinic: true },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Kunjungan dengan ID ${encounterId} tidak ditemukan`,
      );
    }

    const items = await this.itemRepository.find({
      where: { encounterId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    if (!items.length) {
      throw new NotFoundException(
        'Belum ada obat yang diresepkan untuk kunjungan ini',
      );
    }

    const exam = await this.examRepository.findOne({ where: { encounterId } });

    const clinic = encounter.clinic;
    const practitioner = encounter.practitioner;
    const patient = encounter.patient;

    const clinicLocationParts = [clinic?.city, clinic?.province].filter(
      Boolean,
    );
    const age = calculateAge(patient?.birthDate);

    const rxBlocks = items.map((item, index) => {
      const detailParts = [item.dosage, item.frequency]
        .filter(Boolean)
        .join(' ');
      const lines: any[] = [
        {
          text: [
            { text: 'R/  ', style: 'rxMark' },
            { text: item.drugName, style: 'rxDrug' },
          ],
        },
      ];
      if (detailParts) {
        lines.push({
          text: detailParts,
          style: 'rxDetail',
          margin: [24, 1, 0, 0],
        });
      }
      if (item.quantity) {
        lines.push({
          text: `No. ${item.quantity}`,
          style: 'rxDetail',
          margin: [24, 1, 0, 0],
        });
      }
      if (item.duration) {
        lines.push({
          text: `Untuk ${item.duration}`,
          style: 'rxDetail',
          margin: [24, 1, 0, 0],
        });
      }
      if (item.instructions) {
        lines.push({
          text: `S  ${item.instructions}`,
          style: 'rxSignature',
          margin: [24, 3, 0, 0],
        });
      }
      return {
        stack: lines,
        margin: [0, 0, 0, index === items.length - 1 ? 0 : 16],
      };
    });

    const docDefinition: any = {
      pageMargins: [50, 40, 50, 50],
      content: [
        {
          stack: [
            {
              text: clinic?.name || 'Klinik',
              style: 'clinicName',
              alignment: 'center',
            },
            clinic?.address
              ? {
                  text: clinic.address,
                  style: 'clinicMeta',
                  alignment: 'center',
                }
              : null,
            clinicLocationParts.length
              ? {
                  text: clinicLocationParts.join(', '),
                  style: 'clinicMeta',
                  alignment: 'center',
                }
              : null,
            clinic?.phone
              ? {
                  text: `Telp: ${clinic.phone}`,
                  style: 'clinicMeta',
                  alignment: 'center',
                }
              : null,
          ].filter(Boolean),
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 495,
              y2: 0,
              lineWidth: 1.5,
              lineColor: '#4F7EF8',
            },
          ],
          margin: [0, 10, 0, 6],
        },
        {
          columns: [
            {
              text: [
                {
                  text: `dr. ${practitioner?.name || '-'}`,
                  style: 'doctorName',
                },
                practitioner?.specialization
                  ? {
                      text: `\n${practitioner.specialization}`,
                      style: 'clinicMeta',
                    }
                  : null,
              ].filter(Boolean),
            },
            {
              width: 'auto',
              alignment: 'right',
              text: [
                practitioner?.sipNumber
                  ? {
                      text: `SIP: ${practitioner.sipNumber}\n`,
                      style: 'clinicMeta',
                    }
                  : null,
                practitioner?.strNumber
                  ? {
                      text: `STR: ${practitioner.strNumber}`,
                      style: 'clinicMeta',
                    }
                  : null,
              ].filter(Boolean),
            },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          text: new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          alignment: 'right',
          style: 'clinicMeta',
          margin: [0, 0, 0, 20],
        },
        ...rxBlocks,
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 495,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#E8ECF4',
            },
          ],
          margin: [0, 24, 0, 12],
        },
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  columns: [
                    { text: 'Pro', width: 55, style: 'proLabel' },
                    { text: `: ${patient?.name || '-'}`, style: 'proValue' },
                  ],
                },
                {
                  columns: [
                    { text: 'Umur', width: 55, style: 'proLabel' },
                    {
                      text: `: ${age !== null ? `${age} tahun` : '-'}`,
                      style: 'proValue',
                    },
                  ],
                },
                {
                  columns: [
                    { text: 'BB', width: 55, style: 'proLabel' },
                    {
                      text: `: ${exam?.weight ? `${exam.weight} kg` : '-'}`,
                      style: 'proValue',
                    },
                  ],
                },
                {
                  columns: [
                    { text: 'Alamat', width: 55, style: 'proLabel' },
                    { text: `: ${patient?.address || '-'}`, style: 'proValue' },
                  ],
                },
              ],
            },
            {
              width: 160,
              alignment: 'center',
              stack: [
                { text: ' ', margin: [0, 30, 0, 0] },
                {
                  canvas: [
                    {
                      type: 'line',
                      x1: 0,
                      y1: 0,
                      x2: 160,
                      y2: 0,
                      lineWidth: 0.5,
                      lineColor: '#A0AEC0',
                    },
                  ],
                },
                {
                  text: `dr. ${practitioner?.name || '-'}`,
                  style: 'clinicMeta',
                  margin: [0, 4, 0, 0],
                },
              ],
            },
          ],
        },
      ],
      footer: {
        columns: [
          {
            text: 'Resep ini dibuat otomatis oleh sistem ApexRecord.',
            style: 'footerNote',
            margin: [50, 0, 0, 0],
          },
        ],
        margin: [0, 20, 0, 0],
      },
      styles: {
        clinicName: { fontSize: 15, bold: true, color: '#1A2340' },
        clinicMeta: { fontSize: 9, color: '#6B7A99', margin: [0, 1, 0, 0] },
        doctorName: { fontSize: 11, bold: true, color: '#1A2340' },
        rxMark: { fontSize: 14, bold: true, color: '#4F7EF8' },
        rxDrug: { fontSize: 12, bold: true, color: '#1A2340' },
        rxDetail: { fontSize: 10, color: '#1A2340' },
        rxSignature: { fontSize: 10, italics: true, color: '#6B7A99' },
        proLabel: { fontSize: 10, color: '#6B7A99' },
        proValue: { fontSize: 10, color: '#1A2340' },
        footerNote: { fontSize: 8, color: '#A0AEC0', italics: true },
      },
    };

    return PdfMake.createPdf(docDefinition).getBuffer();
  }
}

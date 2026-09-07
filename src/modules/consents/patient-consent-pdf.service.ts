import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientConsent } from './entities/patient-consent.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
// pdfmake's server build exports one process-wide singleton configured via
// setters — already initialized by prescription-pdf.service.ts on import;
// calling the same setters again here is harmless (same values).
import PdfMake = require('pdfmake');

function signatureBlock(
  label: string,
  signature: string | null,
  signerName: string | null,
  signedAt: Date | null,
) {
  return {
    width: '*',
    alignment: 'center',
    stack: [
      { text: label, style: 'sigLabel', margin: [0, 0, 0, 6] },
      signature
        ? { image: signature, width: 140, height: 60, alignment: 'center' }
        : {
            text: 'Belum ditandatangani',
            style: 'sigEmpty',
            margin: [0, 20, 0, 20],
          },
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
        margin: [0, 4, 0, 4],
      },
      { text: signerName || '-', style: 'sigName' },
      signedAt
        ? {
            text: new Date(signedAt).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }),
            style: 'clinicMeta',
          }
        : null,
    ].filter(Boolean),
  };
}

@Injectable()
export class PatientConsentPdfService {
  constructor(
    @InjectRepository(PatientConsent)
    private readonly consentRepository: Repository<PatientConsent>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async generatePdf(id: number, clinicId: number): Promise<Buffer> {
    const consent = await this.consentRepository.findOne({
      where: { id, clinicId },
      relations: { patient: true, tarif: true },
    });
    if (!consent) {
      throw new NotFoundException(
        `Formulir persetujuan dengan ID ${id} tidak ditemukan`,
      );
    }

    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });
    const paragraphs = consent.content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

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
          margin: [0, 10, 0, 16],
        },
        { text: consent.title, style: 'consentTitle', margin: [0, 0, 0, 12] },
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: `Nama Pasien : ${consent.patient?.name || '-'}`,
                  style: 'infoLine',
                },
                {
                  text: `No. RM      : ${consent.patient?.noRm || '-'}`,
                  style: 'infoLine',
                },
              ],
            },
            {
              width: '*',
              stack: [
                {
                  text: `Tindakan    : ${consent.tarif?.name || '-'}`,
                  style: 'infoLine',
                },
                {
                  text: `Tanggal     : ${new Date(consent.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`,
                  style: 'infoLine',
                },
              ],
            },
          ],
          margin: [0, 0, 0, 18],
        },
        ...paragraphs.map((p, idx) => ({
          text: p,
          style: 'bodyText',
          margin: [0, 0, 0, idx === paragraphs.length - 1 ? 24 : 10],
        })),
        {
          columns: [
            signatureBlock(
              'Tanda Tangan Pasien / Wali',
              consent.patientSignature,
              consent.patientSignerName,
              consent.patientSignedAt,
            ),
            { width: 24, text: '' },
            signatureBlock(
              'Tanda Tangan Dokter',
              consent.doctorSignature,
              null,
              consent.doctorSignedAt,
            ),
          ],
        },
      ],
      footer: {
        columns: [
          {
            text: 'Formulir persetujuan ini dibuat oleh sistem ApexRecord.',
            style: 'footerNote',
            margin: [50, 0, 0, 0],
          },
        ],
        margin: [0, 20, 0, 0],
      },
      styles: {
        clinicName: { fontSize: 15, bold: true, color: '#1A2340' },
        clinicMeta: { fontSize: 9, color: '#6B7A99', margin: [0, 1, 0, 0] },
        consentTitle: {
          fontSize: 13,
          bold: true,
          color: '#1A2340',
          alignment: 'center',
        },
        infoLine: { fontSize: 10, color: '#1A2340', margin: [0, 1, 0, 0] },
        bodyText: { fontSize: 10, color: '#1A2340', lineHeight: 1.3 },
        sigLabel: { fontSize: 9, bold: true, color: '#1A2340' },
        sigEmpty: { fontSize: 9, italics: true, color: '#A0AEC0' },
        sigName: { fontSize: 10, bold: true, color: '#1A2340' },
        footerNote: { fontSize: 8, color: '#A0AEC0', italics: true },
      },
    };

    return PdfMake.createPdf(docDefinition).getBuffer();
  }
}

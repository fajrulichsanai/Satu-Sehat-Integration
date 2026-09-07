import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConsentSignerRelation,
  PatientConsent,
} from './entities/patient-consent.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
// pdfmake's server build exports one process-wide singleton configured via
// setters — already initialized by prescription-pdf.service.ts on import;
// calling the same setters again here is harmless (same values).
import PdfMake = require('pdfmake');

const RELATION_LABEL: Record<string, string> = {
  self: 'Pasien sendiri',
  parent: 'Orang tua',
  guardian: 'Wali',
};

const CONSENT_STATEMENTS = [
  'Dokter telah menjelaskan kepada saya mengenai diagnosis, rencana perawatan, tujuan tindakan, risiko, serta alternatif perawatan yang tersedia.',
  'Saya telah diberikan kesempatan untuk mengajukan pertanyaan dan seluruh pertanyaan saya telah dijawab dengan jelas.',
  'Saya memahami bahwa hasil tindakan medis tidak dapat dijamin sepenuhnya dan terdapat risiko yang mungkin terjadi di luar kemampuan dokter.',
  'Persetujuan ini saya berikan dengan penuh kesadaran, tanpa paksaan dari pihak manapun.',
];

function calculateAge(birthDate: Date | string | null): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function genderLabel(gender: string | null | undefined): string | null {
  if (gender === 'male') return 'Laki-laki';
  if (gender === 'female') return 'Perempuan';
  return null;
}

function infoRow(label: string, value: string) {
  return {
    columns: [
      { text: label, width: 110, style: 'infoLine' },
      { text: `: ${value || '-'}`, width: '*', style: 'infoLine' },
    ],
    margin: [0, 1, 0, 0] as [number, number, number, number],
  };
}

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** Best-effort: gagal ambil logo tidak boleh menggagalkan pembuatan PDF. */
  private async fetchLogoDataUri(
    logoUrl: string | null,
  ): Promise<string | null> {
    if (!logoUrl) return null;
    try {
      const res = await fetch(logoUrl, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await res.arrayBuffer());
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

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
    const [doctor, logoDataUri] = await Promise.all([
      consent.doctorSignedBy
        ? this.userRepository.findOne({ where: { id: consent.doctorSignedBy } })
        : Promise.resolve(null),
      this.fetchLogoDataUri(clinic?.logoUrl ?? null),
    ]);

    const patient = consent.patient;
    const isSelf =
      !consent.signerRelation ||
      consent.signerRelation === ConsentSignerRelation.SELF;
    const patientAge = calculateAge(patient?.birthDate ?? null);
    const patientGender = genderLabel(patient?.gender);
    const patientAgeGender = [
      patientAge !== null ? `${patientAge} tahun` : null,
      patientGender,
    ]
      .filter(Boolean)
      .join(', ');

    const signerAgeGender = isSelf ? patientAgeGender : '-';
    const signerAddress = isSelf
      ? patient?.address || '-'
      : consent.signerAddress || '-';
    const signerPhone = isSelf
      ? patient?.phone || '-'
      : consent.signerPhone || '-';

    const headerColumns: any[] = [];
    if (logoDataUri) {
      headerColumns.push({ image: logoDataUri, width: 44, height: 44 });
    }
    headerColumns.push({
      width: '*',
      stack: [
        { text: clinic?.name || 'Klinik', style: 'clinicName' },
        clinic?.address ? { text: clinic.address, style: 'clinicMeta' } : null,
        clinic?.phone
          ? { text: `Telp/WA: ${clinic.phone}`, style: 'clinicMeta' }
          : null,
      ].filter(Boolean),
      alignment: logoDataUri ? 'left' : 'center',
      margin: logoDataUri ? [12, 0, 0, 0] : [0, 0, 0, 0],
    });

    const docDefinition: any = {
      pageMargins: [50, 40, 50, 50],
      content: [
        {
          columns: headerColumns,
          alignment: logoDataUri ? 'left' : 'center',
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
            {
              type: 'line',
              x1: 0,
              y1: 3,
              x2: 495,
              y2: 3,
              lineWidth: 0.5,
              lineColor: '#4F7EF8',
            },
          ],
          margin: [0, 10, 0, 16],
        },
        { text: 'PERSETUJUAN TINDAKAN MEDIS', style: 'consentTitle' },
        {
          text: '(INFORMED CONSENT)',
          style: 'consentSubtitle',
          margin: [0, 0, 0, 18],
        },

        {
          text: 'Saya yang bertanda tangan di bawah ini:',
          style: 'bodyText',
          margin: [0, 0, 0, 6],
        },
        infoRow('Nama', consent.patientSignerName || patient?.name || '-'),
        infoRow('No. RM', patient?.noRm || '-'),
        infoRow('Umur, Jenis Kelamin', signerAgeGender),
        infoRow('Alamat', signerAddress),
        infoRow('No. Telp', signerPhone),
        infoRow(
          'Hubungan dengan pasien',
          RELATION_LABEL[consent.signerRelation || 'self'] || '-',
        ),

        {
          text: [
            'Dengan ini menyatakan ',
            { text: 'SETUJU', bold: true },
            ' atas tindakan medis yang akan dilakukan berupa: ',
            { text: consent.tarif?.name || consent.title, bold: true },
          ],
          style: 'bodyText',
          margin: [0, 14, 0, 14],
        },

        {
          text: 'Terhadap diri saya / pasien berikut:',
          style: 'bodyText',
          margin: [0, 0, 0, 6],
        },
        infoRow('Nama', patient?.name || '-'),
        infoRow('Umur, Jenis Kelamin', patientAgeGender || '-'),
        infoRow('Alamat', patient?.address || '-'),
        infoRow('No. Telp', patient?.phone || '-'),

        {
          text: 'Saya menyatakan bahwa:',
          style: 'bodyText',
          margin: [0, 14, 0, 6],
        },
        {
          ol: CONSENT_STATEMENTS.map((s) => ({ text: s, style: 'bodyText' })),
          margin: [0, 0, 0, 4],
        },
        consent.content
          ? {
              text: consent.content,
              style: 'bodyText',
              italics: true,
              margin: [0, 8, 0, 0],
            }
          : null,

        {
          text: `${clinic?.city || ''}, ${new Date(
            consent.patientSignedAt || consent.createdAt,
          ).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}`,
          style: 'infoLine',
          alignment: 'right',
          margin: [0, 24, 0, 12],
        },

        {
          columns: [
            signatureBlock(
              'Pasien / Wali',
              consent.patientSignature,
              consent.patientSignerName,
              consent.patientSignedAt,
            ),
            { width: 24, text: '' },
            signatureBlock(
              'Dokter',
              consent.doctorSignature,
              doctor?.name ?? null,
              consent.doctorSignedAt,
            ),
          ],
        },
      ].filter(Boolean),
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
          fontSize: 14,
          bold: true,
          color: '#1A2340',
          alignment: 'center',
        },
        consentSubtitle: {
          fontSize: 11,
          bold: true,
          color: '#1A2340',
          alignment: 'center',
        },
        infoLine: { fontSize: 10, color: '#1A2340' },
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

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

const createPdfMock = jest.fn();

jest.mock('pdfmake', () => ({
  setFonts: jest.fn(),
  setLocalAccessPolicy: jest.fn(),
  setUrlAccessPolicy: jest.fn(),
  createPdf: (...args: any[]) => createPdfMock(...args),
}));

import { PatientConsentPdfService } from '../patient-consent-pdf.service';
import {
  ConsentSignerRelation,
  PatientConsent,
} from '../entities/patient-consent.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';

describe('PatientConsentPdfService', () => {
  let service: PatientConsentPdfService;
  let consentRepo: { findOne: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };
  let userRepo: { findOne: jest.Mock };

  const baseConsent = {
    id: 1,
    clinicId: 1,
    title: 'Cabut Gigi',
    content: 'Isi consent',
    createdAt: new Date('2026-01-01'),
    patientSignedAt: null,
    doctorSignedAt: null,
    doctorSignedBy: null,
    patientSignature: null,
    doctorSignature: null,
    patientSignerName: null,
    signerRelation: null,
    signerAddress: null,
    signerPhone: null,
    tarif: { name: 'Cabut Gigi' },
    patient: {
      name: 'Budi',
      noRm: 'RM001',
      birthDate: '2000-01-01',
      gender: 'male',
      address: 'Jl. A',
      phone: '0811',
    },
  };

  beforeEach(async () => {
    createPdfMock.mockClear();
    createPdfMock.mockReturnValue({
      getBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    });
    consentRepo = { findOne: jest.fn() };
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Klinik A' }) };
    userRepo = { findOne: jest.fn() };
    global.fetch = jest.fn() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientConsentPdfService,
        { provide: getRepositoryToken(PatientConsent), useValue: consentRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<PatientConsentPdfService>(PatientConsentPdfService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('generates a PDF buffer for an existing consent (positive)', async () => {
    consentRepo.findOne.mockResolvedValue({ ...baseConsent });

    const result = await service.generatePdf(1, 1);

    expect(result).toBeInstanceOf(Buffer);
  });

  it('throws NotFoundException when consent does not exist (negative)', async () => {
    consentRepo.findOne.mockResolvedValue(null);
    await expect(service.generatePdf(999, 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(createPdfMock).not.toHaveBeenCalled();
  });

  it('looks up the signing doctor when doctorSignedBy is set (positive)', async () => {
    consentRepo.findOne.mockResolvedValue({
      ...baseConsent,
      doctorSignedBy: 7,
      doctorSignature: 'data:doc-sig',
      doctorSignedAt: new Date(),
    });
    userRepo.findOne.mockResolvedValue({ id: 7, name: 'Dr. A' });

    await service.generatePdf(1, 1);

    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('skips the doctor lookup when no doctor has signed yet (negative/edge)', async () => {
    consentRepo.findOne.mockResolvedValue({ ...baseConsent });
    await service.generatePdf(1, 1);
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('degrades gracefully when the clinic logo fetch fails (negative/edge)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    clinicRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'Klinik A',
      logoUrl: 'https://cdn/logo.png',
    });
    consentRepo.findOne.mockResolvedValue({ ...baseConsent });

    await expect(service.generatePdf(1, 1)).resolves.toBeInstanceOf(Buffer);

    const doc = createPdfMock.mock.calls[0][0];
    expect(doc.content[0].columns).toHaveLength(1); // no logo image column
  });

  it('embeds the fetched logo as a data URI when available (positive)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => Buffer.from('img').buffer,
    });
    clinicRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'Klinik A',
      logoUrl: 'https://cdn/logo.png',
    });
    consentRepo.findOne.mockResolvedValue({ ...baseConsent });

    await service.generatePdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    expect(doc.content[0].columns[0].image).toContain('data:image/png;base64,');
  });

  it('uses signer address/phone for a guardian rather than the patient’s own (positive)', async () => {
    consentRepo.findOne.mockResolvedValue({
      ...baseConsent,
      signerRelation: ConsentSignerRelation.PARENT,
      signerAddress: 'Jl. Wali',
      signerPhone: '0899',
    });

    await service.generatePdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const addressRow = doc.content.find(
      (c: any) =>
        c?.columns?.[0]?.text === 'Alamat' && c.columns[1].text === ': Jl. Wali',
    );
    expect(addressRow).toBeDefined();
  });

  it('falls back to the patient’s own address/phone for a self signer (positive/edge)', async () => {
    consentRepo.findOne.mockResolvedValue({ ...baseConsent, signerRelation: null });

    await service.generatePdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const addressRow = doc.content.find(
      (c: any) =>
        c?.columns?.[0]?.text === 'Alamat' && c.columns[1].text === ': Jl. A',
    );
    expect(addressRow).toBeDefined();
  });
});

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

import { PrescriptionPdfService } from '../prescription-pdf.service';
import { PrescriptionItem } from '../entities/prescription-item.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { PhysicalExamination } from '../../physical-examination/entities/physical-examination.entity';

describe('PrescriptionPdfService', () => {
  let service: PrescriptionPdfService;
  let itemRepo: { find: jest.Mock };
  let encounterRepo: { findOne: jest.Mock };
  let examRepo: { findOne: jest.Mock };

  const baseEncounter = {
    id: 1,
    clinicId: 1,
    clinic: { name: 'Klinik A', address: 'Jl. A', phone: '0800' },
    practitioner: { name: 'Andi', specialization: 'Gigi', sipNumber: 'SIP1' },
    patient: { name: 'Budi', birthDate: '2000-01-01', address: 'Jl. B' },
  };

  beforeEach(async () => {
    createPdfMock.mockClear();
    createPdfMock.mockReturnValue({
      getBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    });
    itemRepo = { find: jest.fn() };
    encounterRepo = { findOne: jest.fn() };
    examRepo = { findOne: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionPdfService,
        { provide: getRepositoryToken(PrescriptionItem), useValue: itemRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: getRepositoryToken(PhysicalExamination), useValue: examRepo },
      ],
    }).compile();

    service = module.get<PrescriptionPdfService>(PrescriptionPdfService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('generates a PDF buffer when the encounter has prescription items (positive)', async () => {
    encounterRepo.findOne.mockResolvedValue({ ...baseEncounter });
    itemRepo.find.mockResolvedValue([
      { drugName: 'Amoxicillin', dosage: '500mg', frequency: '3x1', quantity: 10, duration: '5 hari', instructions: 'Habiskan' },
    ]);

    const result = await service.generatePrescriptionPdf(1, 1);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('throws NotFoundException when the encounter does not exist (negative)', async () => {
    encounterRepo.findOne.mockResolvedValue(null);
    await expect(service.generatePrescriptionPdf(999, 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(itemRepo.find).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when there are no prescription items yet (negative)', async () => {
    encounterRepo.findOne.mockResolvedValue({ ...baseEncounter });
    itemRepo.find.mockResolvedValue([]);
    await expect(service.generatePrescriptionPdf(1, 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(createPdfMock).not.toHaveBeenCalled();
  });

  it('includes the weight from the physical exam when available (positive)', async () => {
    encounterRepo.findOne.mockResolvedValue({ ...baseEncounter });
    itemRepo.find.mockResolvedValue([{ drugName: 'X' }]);
    examRepo.findOne.mockResolvedValue({ weight: 60 });

    await service.generatePrescriptionPdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const proStack = doc.content.find((c: any) => c.columns?.[0]?.width === '*')
      ?.columns[0].stack;
    const bbRow = proStack.find((r: any) => r.columns[0].text === 'BB');
    expect(bbRow.columns[1].text).toBe(': 60 kg');
  });

  it('shows a dash for weight when no physical exam exists (negative/edge)', async () => {
    encounterRepo.findOne.mockResolvedValue({ ...baseEncounter });
    itemRepo.find.mockResolvedValue([{ drugName: 'X' }]);
    examRepo.findOne.mockResolvedValue(null);

    await service.generatePrescriptionPdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const proStack = doc.content.find((c: any) => c.columns?.[0]?.width === '*')
      ?.columns[0].stack;
    const bbRow = proStack.find((r: any) => r.columns[0].text === 'BB');
    expect(bbRow.columns[1].text).toBe(': -');
  });

  it('renders each prescription item as a separate Rx block (positive)', async () => {
    encounterRepo.findOne.mockResolvedValue({ ...baseEncounter });
    itemRepo.find.mockResolvedValue([
      { drugName: 'A' },
      { drugName: 'B' },
    ]);

    await service.generatePrescriptionPdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const rxBlocks = doc.content.filter(
      (c: any) => c.stack?.[0]?.text?.[1]?.text === 'A' || c.stack?.[0]?.text?.[1]?.text === 'B',
    );
    expect(rxBlocks).toHaveLength(2);
  });
});

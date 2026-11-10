import { BadRequestException } from '@nestjs/common';
import { DiagnosticsService } from '../diagnostics.service';

describe('DiagnosticsService.saveLabResults', () => {
  const catalog = {
    getLab: jest.fn((code: string) => ({
      code,
      system: 'http://loinc.org',
      display: `Test ${code}`,
      name: `Tes ${code}`,
      use: 'Permintaan & Hasil',
      unit: 'mg/dL',
      answers: [],
    })),
  };
  let order: any;
  let resultRepo: any;
  let labRepo: any;
  let service: DiagnosticsService;

  beforeEach(() => {
    order = {
      id: 3,
      encounterId: 5,
      status: 'collected',
      results: [
        { id: 11, code: '2345-7', createdBy: 1 },
        { id: 12, code: '2093-3', createdBy: 1 },
      ],
    };
    resultRepo = {
      create: jest.fn((d) => d),
      save: jest.fn(),
      delete: jest.fn(),
    };
    labRepo = { findOne: jest.fn(async () => order), save: jest.fn() };
    service = new DiagnosticsService(
      labRepo,
      resultRepo,
      {} as any,
      { exists: jest.fn(async () => true) } as any,
      catalog as any,
      { exists: jest.fn(async () => false) } as any,
    );
  });

  it('updates existing results in place so their SATUSEHAT link is reused (positive)', async () => {
    await service.saveLabResults(
      5,
      1,
      3,
      { results: [{ code: '2345-7', valueNumber: 110 }] },
      9,
    );
    const saved = resultRepo.save.mock.calls[0][0];
    expect(saved).toEqual([
      expect.objectContaining({ id: 11, code: '2345-7', valueNumber: '110' }),
    ]);
    // Parameter yang tidak diisi lagi dihapus; yang tetap tidak dihapus-buat ulang
    expect(resultRepo.delete).toHaveBeenCalledTimes(1);
    expect(resultRepo.delete.mock.calls[0][0].id.value).toEqual([12]);
  });

  it('creates a new row for a parameter that was not there before (edge)', async () => {
    await service.saveLabResults(
      5,
      1,
      3,
      {
        results: [
          { code: '2345-7', valueNumber: 110 },
          { code: '2093-3', valueNumber: 190 },
          { code: '2571-8', valueNumber: 150 },
        ],
      },
      9,
    );
    const saved = resultRepo.save.mock.calls[0][0];
    expect(saved.map((r: any) => r.id)).toEqual([11, 12, undefined]);
    expect(resultRepo.delete).not.toHaveBeenCalled();
  });

  it('rejects the same parameter twice (negative)', async () => {
    await expect(
      service.saveLabResults(
        5,
        1,
        3,
        {
          results: [
            { code: '2345-7', valueNumber: 110 },
            { code: '2345-7', valueNumber: 120 },
          ],
        },
        9,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses to delete a request already sent to SATUSEHAT (negative)', async () => {
    const svc = new DiagnosticsService(
      labRepo,
      resultRepo,
      {} as any,
      { exists: jest.fn(async () => true) } as any,
      catalog as any,
      { exists: jest.fn(async () => true) } as any,
    );
    await expect(svc.removeLab(5, 1, 3)).rejects.toThrow('Batalkan');
  });
});

import { MedicationHistoryService } from '../medication-history.service';

describe('MedicationHistoryService.normalize', () => {
  const linkRepo = { exists: jest.fn() };
  const service = new MedicationHistoryService(linkRepo as any);
  const prev = [
    {
      key: 'aaaa1111',
      kfaCode: '93001819',
      name: 'Amlodipine 5 mg',
      dosage: null,
      active: true,
    },
    {
      key: 'bbbb2222',
      kfaCode: null,
      name: 'Jamu',
      dosage: null,
      active: true,
    },
  ];

  it('keeps existing keys, trims text and defaults to active (positive)', async () => {
    linkRepo.exists.mockResolvedValue(false);
    const out = await service.normalize(
      [
        { key: 'aaaa1111', kfaCode: '93001819', name: ' Amlodipine 5 mg ' },
        { name: 'Metformin', dosage: ' 2x1 ', active: false },
      ],
      prev,
      1,
      7,
    );
    expect(out[0]).toMatchObject({
      key: 'aaaa1111',
      name: 'Amlodipine 5 mg',
      active: true,
    });
    expect(out[1]).toMatchObject({
      kfaCode: null,
      dosage: '2x1',
      active: false,
    });
    expect(out[1].key).toMatch(/^[0-9a-f]{8}$/);
    expect(out).toHaveLength(2);
  });

  it('keeps a removed entry that was already sent so it can be voided (edge)', async () => {
    linkRepo.exists.mockImplementation(
      async ({ where }) => where.localType === 'pt_medst_aaaa1111',
    );
    const out = await service.normalize([], prev, 1, 7);
    expect(out).toEqual([{ ...prev[0], removed: true }]);
  });

  it('never invents a key for a stranger row (negative)', async () => {
    linkRepo.exists.mockResolvedValue(false);
    const out = await service.normalize(
      [{ key: 'zzzz9999', name: 'Obat X' }],
      prev,
      1,
      null,
    );
    expect(out[0].key).not.toBe('zzzz9999');
    expect(linkRepo.exists).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ localId: null }),
      }),
    );
  });
});

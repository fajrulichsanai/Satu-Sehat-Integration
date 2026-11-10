import { FamilyHistoryService } from '../family-history.service';

describe('FamilyHistoryService.normalize', () => {
  const terminology = {
    resolve: jest.fn(async (items: { system: string; code: string }[]) => {
      if (items.some((i) => i.code === 'XX9')) throw new Error('tidak dikenal');
      return new Map(
        items.map((i) => [
          `${i.system}:${i.code}`,
          { display: `Name ${i.code}` },
        ]),
      );
    }),
    nameIdFor: jest.fn(() => null),
  };
  const linkRepo = { exists: jest.fn() };
  const service = new FamilyHistoryService(terminology as any, linkRepo as any);
  const prev = [
    {
      key: 'aaaa1111',
      relationship: 'FTH' as const,
      code: 'E11',
      display: 'Name E11',
      nameId: null,
      note: null,
    },
    {
      key: 'bbbb2222',
      relationship: 'MTH' as const,
      code: 'I10',
      display: 'Name I10',
      nameId: null,
      note: null,
    },
  ];

  it('keeps existing keys, uppercases codes and takes names from terminology (positive)', async () => {
    linkRepo.exists.mockResolvedValue(false);
    const out = await service.normalize(
      [
        { key: 'aaaa1111', relationship: 'FTH', code: 'e11' },
        { relationship: 'SIS', code: 'j45', note: ' asma ' },
      ],
      prev,
      1,
      7,
    );
    expect(out[0]).toMatchObject({
      key: 'aaaa1111',
      code: 'E11',
      display: 'Name E11',
    });
    expect(out[1]).toMatchObject({ code: 'J45', note: 'asma' });
    expect(out[1].key).toMatch(/^[0-9a-f]{8}$/);
    // I10 removed and never sent → dropped
    expect(out).toHaveLength(2);
  });

  it('keeps a removed entry that was already sent so it can be voided (edge)', async () => {
    linkRepo.exists.mockImplementation(
      async ({ where }: any) => where.localType === 'pt_fmh_bbbb2222',
    );
    const out = await service.normalize(
      [{ key: 'aaaa1111', relationship: 'FTH', code: 'E11' }],
      prev,
      1,
      7,
    );
    expect(out.map((e) => [e.key, !!e.removed])).toEqual([
      ['aaaa1111', false],
      ['bbbb2222', true],
    ]);
  });

  it('rejects unknown ICD-10 codes (negative)', async () => {
    await expect(
      service.normalize([{ relationship: 'FTH', code: 'XX9' }], null, 1, null),
    ).rejects.toThrow('tidak dikenal');
  });
});

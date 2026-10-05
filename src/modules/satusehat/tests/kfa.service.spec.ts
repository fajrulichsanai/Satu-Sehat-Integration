import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KfaService, normalizeKfaProduct } from '../kfa/kfa.service';

const DETAIL = {
  name: 'Abacavir Sulfate 300 mg Tablet Salut Selaput (KIMIA FARMA)',
  kfa_code: '93015993',
  active: true,
  farmalkes_type: { code: 'medicine', name: 'Obat', group: 'farmasi' },
  dosage_form: { code: 'BS077', name: 'Tablet Salut Selaput' },
  rute_pemberian: { code: 'O', name: 'Oral' },
  uom: { name: 'Tablet' },
  nie: 'GKL2012431917A1',
  manufacturer: 'KIMIA FARMA TBK',
  generik: true,
  product_template: {
    kfa_code: '92000888',
    name: 'Abacavir Sulfate 300 mg Tablet Salut Selaput',
    display_name: 'Abacavir Sulfate 300 mg Tablet Salut Selaput',
  },
  active_ingredients: [
    {
      kfa_code: '91000651',
      zat_aktif: 'Abacavir',
      kekuatan_zat_aktif: '300 mg',
    },
  ],
};

describe('KfaService', () => {
  let fetchMock: jest.Mock;
  let service: KfaService;
  const json = (status: number, body: unknown) =>
    ({
      ok: status < 300,
      status,
      json: () => Promise.resolve(body),
    }) as Response;

  let catalog: Record<string, jest.Mock>;

  beforeEach(() => {
    catalog = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new KfaService(
      { getAccessToken: jest.fn().mockResolvedValue('tok') } as any,
      { get: jest.fn().mockReturnValue('sandbox') } as any,
      catalog as any,
    );
  });

  it('normalizes the KFA v2 detail payload (positive)', () => {
    expect(normalizeKfaProduct(DETAIL)).toEqual({
      kfaCode: '93015993',
      name: 'Abacavir Sulfate 300 mg Tablet Salut Selaput (KIMIA FARMA)',
      active: true,
      group: 'farmasi',
      dosageForm: { code: 'BS077', name: 'Tablet Salut Selaput' },
      route: { code: 'O', name: 'Oral' },
      uom: 'Tablet',
      manufacturer: 'KIMIA FARMA TBK',
      nie: 'GKL2012431917A1',
      generic: true,
      template: {
        code: '92000888',
        name: 'Abacavir Sulfate 300 mg Tablet Salut Selaput',
      },
      activeIngredients: [
        { kfaCode: '91000651', name: 'Abacavir', strength: '300 mg' },
      ],
    });
  });

  it('treats `false` placeholders as empty (edge)', () => {
    const p = normalizeKfaProduct({
      kfa_code: '93000001',
      name: 'X',
      dosage_form: { code: false, name: false },
    });
    expect(p.dosageForm).toBeNull();
    expect(p.activeIngredients).toEqual([]);
  });

  it('search calls /kfa-v2/products/all and drops items without a usable code (positive)', async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        total: 2,
        page: 1,
        size: 20,
        items: { data: [DETAIL, { ...DETAIL, kfa_code: '/' }] },
      }),
    );
    const result = await service.search({ keyword: 'abacavir' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api-satusehat-stg.dto.kemkes.go.id/kfa-v2/products/all?page=1&size=20&product_type=farmasi&keyword=abacavir',
    );
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(result.items.map((i) => i.kfaCode)).toEqual(['93015993']);
  });

  it('getProduct calls the detail endpoint once and caches it (positive)', async () => {
    fetchMock.mockResolvedValue(json(200, { result: DETAIL }));
    await service.getProduct('93015993');
    await service.getProduct('93015993');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api-satusehat-stg.dto.kemkes.go.id/kfa-v2/products?identifier=kfa&code=93015993',
    );
  });

  it('getProduct validates the code and reports unknown codes (negative)', async () => {
    await expect(service.getProduct('123')).rejects.toThrow(
      BadRequestException,
    );
    fetchMock.mockResolvedValue(json(200, { result: null }));
    await expect(service.getProduct('93999999')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('local catalog', () => {
    const qb = (raw: unknown, rows: unknown[] = [], total = 0) => {
      const b: Record<string, jest.Mock> = {};
      for (const m of [
        'where',
        'andWhere',
        'orderBy',
        'skip',
        'take',
        'select',
        'addSelect',
      ]) {
        b[m] = jest.fn(() => b);
      }
      b.getRawOne = jest.fn().mockResolvedValue(raw);
      b.getManyAndCount = jest.fn().mockResolvedValue([rows, total]);
      return b;
    };

    it('full sync pages through KFA and upserts only 8-digit codes (positive)', async () => {
      const page = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
          ...DETAIL,
          kfa_code: String(93000000 + i),
          updated_at: '2026-09-01 10:00:00',
        }));
      fetchMock
        .mockResolvedValueOnce(
          json(200, { total: 150, items: { data: page(100) } }),
        )
        .mockResolvedValueOnce(
          json(200, {
            total: 150,
            items: { data: [...page(49), { kfa_code: '/' }] },
          }),
        );
      const result = await service.syncCatalog({ full: true });
      expect(result).toEqual({ pages: 2, saved: 149 });
      expect(fetchMock.mock.calls[0][0]).toContain(
        'page=1&size=100&product_type=farmasi',
      );
      expect(fetchMock.mock.calls[0][0]).not.toContain('from_date');
      const saved = catalog.upsert.mock.calls[0][0][0];
      expect(saved).toMatchObject({
        kfaCode: '93000000',
        dosageFormCode: 'BS077',
        group: 'farmasi',
      });
      expect(saved.kfaUpdatedAt.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    });

    it('incremental sync starts one day before the last KFA update (edge)', async () => {
      catalog.createQueryBuilder.mockReturnValue(
        qb({
          products: '10',
          lastSyncedAt: null,
          lastKfaUpdate: new Date('2026-09-10T05:00:00Z'),
        }),
      );
      fetchMock.mockResolvedValue(json(200, { total: 0, items: { data: [] } }));
      await service.syncCatalog();
      expect(fetchMock.mock.calls[0][0]).toContain('from_date=2026-09-09');
    });

    it('concurrent sync calls share one run (edge)', async () => {
      fetchMock.mockResolvedValue(json(200, { total: 0, items: { data: [] } }));
      const [a, b] = await Promise.all([
        service.syncCatalog({ full: true }),
        service.syncCatalog({ full: true }),
      ]);
      expect(a).toBe(b);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('search uses the local table once it has products (positive)', async () => {
      catalog.count.mockResolvedValue(5);
      const builder = qb(
        null,
        [
          {
            kfaCode: '93015993',
            name: 'Abacavir 300 mg',
            active: true,
            activeIngredients: null,
          },
        ],
        1,
      );
      catalog.createQueryBuilder.mockReturnValue(builder);
      const result = await service.search({ keyword: 'abacavir 300' });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        kfaCode: '93015993',
        activeIngredients: [],
      });
    });

    it('getProduct falls back to the local copy when KFA is down (negative)', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));
      catalog.findOne.mockResolvedValue({
        kfaCode: '93015993',
        name: 'Abacavir',
        active: true,
        dosageFormCode: 'BS077',
        dosageFormName: 'Tablet',
      });
      const p = await service.getProduct('93015993');
      expect(p.dosageForm).toEqual({ code: 'BS077', name: 'Tablet' });
      catalog.findOne.mockResolvedValue(null);
      await expect(service.getProduct('93015994')).rejects.toThrow(
        'Koneksi ke KFA SATUSEHAT gagal',
      );
    });
  });
});

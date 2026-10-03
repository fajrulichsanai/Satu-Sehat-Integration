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

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new KfaService(
      { getAccessToken: jest.fn().mockResolvedValue('tok') } as any,
      { get: jest.fn().mockReturnValue('sandbox') } as any,
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
});

import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MasterDataService } from '../master-data.service';
import { SatusehatGlobalOauthService } from '../../satusehat/satusehat-global-oauth.service';
import { JenisSarana, SearchSaranaQueryDto } from '../dto/master-data.dto';

describe('MasterDataService – Master Sarana Index', () => {
  let service: MasterDataService;
  let fetchMock: jest.Mock;

  const jsonResponse = (status: number, body: unknown) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'status',
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  beforeEach(() => {
    const oauth = {
      getAccessToken: jest.fn().mockResolvedValue('token-123'),
    } as unknown as SatusehatGlobalOauthService;
    const config = {
      get: jest.fn().mockReturnValue('sandbox'),
    } as unknown as ConfigService;
    service = new MasterDataService(oauth, config);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('meneruskan filter ke endpoint MSI dan menormalkan respons', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        status_code: 200,
        message: 'Success',
        page: 2,
        total_page: 5,
        data: [
          { kode_satusehat: '1000000001', kode_sarana: 'K1', nama: 'Klinik A' },
        ],
      }),
    );

    const query = Object.assign(new SearchSaranaQueryDto(), {
      page: 2,
      limit: 10,
      jenis_sarana: JenisSarana.KLINIK,
      nama: 'Klinik A',
    });
    const result = await service.searchSarana(query);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'https://api-satusehat-stg.dto.kemkes.go.id/masterdata/v1/mastersaranaindex/mastersarana',
    );
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      page: '2',
      limit: '10',
      jenis_sarana: '103',
      nama: 'Klinik A',
    });
    expect(init.headers).toEqual({ Authorization: 'Bearer token-123' });
    expect(result).toEqual({
      page: 2,
      totalPage: 5,
      items: [
        { kode_satusehat: '1000000001', kode_sarana: 'K1', nama: 'Klinik A' },
      ],
    });
  });

  it('mengubah error 4xx SATUSEHAT menjadi BadRequest', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        status_code: 400,
        message: 'limit cannot be more than 2000',
        data: null,
      }),
    );
    await expect(
      service.searchSarana(new SearchSaranaQueryDto()),
    ).rejects.toThrow(BadRequestException);
  });

  it('mengubah gagal koneksi menjadi ServiceUnavailable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      service.searchSarana(new SearchSaranaQueryDto()),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('getSaranaByKodeSatusehat: validasi format & not found', async () => {
    await expect(service.getSaranaByKodeSatusehat('123')).rejects.toThrow(
      BadRequestException,
    );

    fetchMock.mockResolvedValue(
      jsonResponse(200, { status_code: 200, message: 'Success', data: [] }),
    );
    await expect(
      service.getSaranaByKodeSatusehat('1000000001'),
    ).rejects.toThrow(NotFoundException);
  });

  it('Master Wilayah v1: query di-encode dan param codes diteruskan', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { status: 200, error: false, message: 'ok', data: [] }),
    );
    await service.getCities('32&x=1', '3273');
    const [url] = fetchMock.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/masterdata/v1/cities');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      province_codes: '32&x=1',
      codes: '3273',
    });
  });

  it('Master Wilayah v2: memanggil /v2 dan mengembalikan items + meta', async () => {
    const meta = { item_count: 1, page: { current: 1, total_page: 3 } };
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        status: 200,
        error: false,
        message: 'ok',
        data: [
          { code: '32', parent_code: '', bps_code: '32', name: 'Jawa Barat' },
        ],
        meta,
      }),
    );
    const res = await service.getWilayahV2('provinces', { current_page: 1 });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      'https://api-satusehat-stg.dto.kemkes.go.id/masterdata/v2/provinces?current_page=1',
    );
    expect(res.items[0].name).toBe('Jawa Barat');
    expect(res.meta).toEqual(meta);
  });
});

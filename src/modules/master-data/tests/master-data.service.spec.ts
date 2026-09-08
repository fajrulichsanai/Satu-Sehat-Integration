import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { MasterDataService } from '../master-data.service';
import { SatusehatGlobalOauthService } from '../../satusehat/satusehat-global-oauth.service';

describe('MasterDataService', () => {
  let oauthService: { getAccessToken: jest.Mock };

  function buildService(env: string) {
    return Test.createTestingModule({
      providers: [
        MasterDataService,
        { provide: SatusehatGlobalOauthService, useValue: oauthService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => env) },
        },
      ],
    }).compile();
  }

  beforeEach(() => {
    oauthService = { getAccessToken: jest.fn().mockResolvedValue('token-abc') };
    global.fetch = jest.fn() as any;
  });

  it('should be defined', async () => {
    const module = await buildService('sandbox');
    expect(module.get(MasterDataService)).toBeDefined();
  });

  describe('getProvinces', () => {
    it('fetches from the sandbox base URL by default (positive)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);

      await service.getProvinces();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api-satusehat-stg.dto.kemkes.go.id'),
        expect.any(Object),
      );
    });

    it('fetches from the production base URL when configured (positive)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      const module = await buildService('production');
      const service = module.get(MasterDataService);

      await service.getProvinces();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/api-satusehat\.kemkes\.go\.id/),
        expect.any(Object),
      );
    });

    it('appends codes as a query param when provided (positive)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);

      await service.getProvinces('11,12');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('provinces?codes=11,12'),
        expect.any(Object),
      );
    });

    it('sends the bearer token from the oauth service (positive)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);

      await service.getProvinces();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
        }),
      );
    });

    it('throws ServiceUnavailableException when the upstream responds with an error status (negative)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);

      await expect(service.getProvinces()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when fetch itself throws (negative)', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);

      await expect(service.getProvinces()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when the oauth token fetch fails (negative)', async () => {
      oauthService.getAccessToken.mockRejectedValue(new Error('oauth down'));
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);

      await expect(service.getProvinces()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getCities / getDistricts / getSubDistricts', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    it('getCities appends province_codes param (positive)', async () => {
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);
      await service.getCities('11');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('cities?province_codes=11'),
        expect.any(Object),
      );
    });

    it('getDistricts appends city_codes param (positive)', async () => {
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);
      await service.getDistricts('1101');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('districts?city_codes=1101'),
        expect.any(Object),
      );
    });

    it('getSubDistricts appends district_codes param (positive)', async () => {
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);
      await service.getSubDistricts('110101');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sub-districts?district_codes=110101'),
        expect.any(Object),
      );
    });

    it('omits the query string when no filter is given (edge)', async () => {
      const module = await buildService('sandbox');
      const service = module.get(MasterDataService);
      await service.getCities();
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(calledUrl.endsWith('/cities')).toBe(true);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { SatusehatGlobalOauthService } from '../satusehat-global-oauth.service';
import { SatusehatEnvironment } from '../../../enums/satusehat-environment.enum';

describe('SatusehatGlobalOauthService', () => {
  let service: SatusehatGlobalOauthService;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn((key: string) => {
      if (key === 'SATUSEHAT_GLOBAL_CLIENT_ID') return 'client-id';
      if (key === 'SATUSEHAT_GLOBAL_CLIENT_SECRET') return 'client-secret';
      return undefined;
    });
    global.fetch = jest.fn() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SatusehatGlobalOauthService,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get<SatusehatGlobalOauthService>(
      SatusehatGlobalOauthService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('fetches and caches a new token on first call (positive)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok-1', expires_in: '3600' }),
    });

    const token = await service.getAccessToken(SatusehatEnvironment.SANDBOX);

    expect(token).toBe('tok-1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached token when it is still comfortably valid (positive)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok-1', expires_in: '3600' }),
    });

    await service.getAccessToken(SatusehatEnvironment.SANDBOX);
    const token2 = await service.getAccessToken(SatusehatEnvironment.SANDBOX);

    expect(token2).toBe('tok-1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes the token once it is within the 30-minute expiry buffer (edge)', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok-1', expires_in: '1500' }), // 25 min, inside buffer
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok-2', expires_in: '3600' }),
      });

    const token1 = await service.getAccessToken(SatusehatEnvironment.SANDBOX);
    const token2 = await service.getAccessToken(SatusehatEnvironment.SANDBOX);

    expect(token1).toBe('tok-1');
    expect(token2).toBe('tok-2');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('caches sandbox and production tokens independently (positive/edge)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok-shared-call', expires_in: '3600' }),
    });

    await service.getAccessToken(SatusehatEnvironment.SANDBOX);
    await service.getAccessToken(SatusehatEnvironment.PRODUCTION);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('stg');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).not.toContain('stg');
  });

  it('throws ServiceUnavailableException when credentials are not configured (negative)', async () => {
    configGet.mockReturnValue(undefined);
    await expect(
      service.getAccessToken(SatusehatEnvironment.SANDBOX),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException when the auth endpoint responds with an error (negative)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });
    await expect(
      service.getAccessToken(SatusehatEnvironment.SANDBOX),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException when fetch itself throws (negative)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));
    await expect(
      service.getAccessToken(SatusehatEnvironment.SANDBOX),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

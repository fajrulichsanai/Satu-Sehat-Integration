import { ServiceUnavailableException } from '@nestjs/common';
import {
  SatusehatClientService,
  encryptClientSecret,
} from '../satusehat-client.service';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { SatusehatEnvironment } from '../../../enums/satusehat-environment.enum';

describe('SatusehatClientService', () => {
  const KEY = 'unit-test-patient-data-key-32-chars';
  let clinic: Partial<Clinic>;
  let repo: { findOne: jest.Mock; update: jest.Mock };
  let fetchMock: jest.Mock;
  let service: SatusehatClientService;
  const originalKey = process.env.PATIENT_DATA_ENCRYPTION_KEY;

  const json = (status: number, body: unknown) =>
    ({
      ok: status < 300,
      status,
      json: () => Promise.resolve(body),
    }) as Response;

  beforeEach(() => {
    process.env.PATIENT_DATA_ENCRYPTION_KEY = KEY;
    clinic = {
      id: 1,
      satusehatOrgId: '100025702',
      satusehatClientId: 'cid',
      satusehatClientSecret: encryptClientSecret('the-secret'),
      satusehatEnvironment: SatusehatEnvironment.SANDBOX,
      satusehatToken: null,
      satusehatTokenExpiresAt: null,
    };
    repo = {
      findOne: jest.fn(async () => clinic),
      update: jest.fn(async (_id, patch) => Object.assign(clinic, patch)),
    };
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new SatusehatClientService(repo as any);
  });

  afterAll(() => {
    process.env.PATIENT_DATA_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts the client secret (never stored in plaintext) (positive)', () => {
    expect(clinic.satusehatClientSecret).not.toContain('the-secret');
  });

  it('requests a token with the decrypted secret and caches it (positive)', async () => {
    fetchMock.mockResolvedValue(
      json(200, { access_token: 'tok-1', expires_in: '3599' }),
    );

    await expect(service.getAccessToken(1)).resolves.toBe('tok-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1/accesstoken?grant_type=client_credentials',
    );
    expect(String(init.body)).toContain('client_secret=the-secret');

    // Second call uses the cached token
    await expect(service.getAccessToken(1)).resolves.toBe('tok-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes a token that is about to expire (edge)', async () => {
    clinic.satusehatToken = 'old';
    clinic.satusehatTokenExpiresAt = new Date(Date.now() + 60_000);
    fetchMock.mockResolvedValue(
      json(200, { access_token: 'new', expires_in: '3599' }),
    );
    await expect(service.getAccessToken(1)).resolves.toBe('new');
  });

  it('rejects when the clinic has no SATUSEHAT configuration (negative)', async () => {
    clinic.satusehatClientSecret = null;
    await expect(service.getAccessToken(1)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with a clear message when SATUSEHAT refuses the credentials (negative)', async () => {
    fetchMock.mockResolvedValue(json(401, {}));
    await expect(service.getAccessToken(1)).rejects.toThrow(
      /periksa Client ID, Client Secret/,
    );
  });

  it('searches Patient by NIK with an encoded identifier on the production base (positive)', async () => {
    clinic.satusehatEnvironment = SatusehatEnvironment.PRODUCTION;
    fetchMock
      .mockResolvedValueOnce(
        json(200, { access_token: 'tok', expires_in: '3599' }),
      )
      .mockResolvedValueOnce(json(200, { resourceType: 'Bundle', entry: [] }));
    await service.searchPatientByNik(1, '9271060312000001');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      'https://api-satusehat.kemkes.go.id/fhir-r4/v1/Patient?identifier=https%3A%2F%2Ffhir.kemkes.go.id%2Fid%2Fnik%7C9271060312000001',
    );
    expect(init.headers.Authorization).toBe('Bearer tok');
  });
});

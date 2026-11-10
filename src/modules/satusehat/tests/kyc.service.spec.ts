import { BadRequestException } from '@nestjs/common';
import { KycService, kycError } from '../kyc/kyc.service';
import {
  decryptKycMessage,
  encryptKycMessage,
  generateKycKeyPair,
  isEncryptedMessage,
} from '../kyc/kyc-crypto';

describe('KycService (Juknis KYC v6.4)', () => {
  // Pasangan kunci "SATUSEHAT" tiruan — server membaca pesan dengan private key-nya
  const server = generateKycKeyPair();
  const NIK_AGENT = '3201010101010001';
  const NIK_PATIENT = '3201010101010002';
  let practitionerRepo: { findOne: jest.Mock };
  let patientRepo: { findOne: jest.Mock };
  let client: { postKyc: jest.Mock };
  let service: KycService;
  let agentPublicKey = '';
  const requests: { endpoint: string; body: any; headers: any }[] = [];

  beforeAll(() => {
    process.env.SATUSEHAT_KYC_PUBLIC_KEY = server.publicKey;
  });
  afterAll(() => {
    delete process.env.SATUSEHAT_KYC_PUBLIC_KEY;
  });

  beforeEach(() => {
    requests.length = 0;
    practitionerRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ name: 'drg. Ratna', nik: NIK_AGENT }),
    };
    patientRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 9, name: 'Budi Santoso', nik: NIK_PATIENT }),
    };
    client = {
      postKyc: jest.fn(async (_c, endpoint, text: string, headers = {}) => {
        await Promise.resolve();
        const body = JSON.parse(
          headers['Content-Type'] === 'application/json'
            ? text
            : decryptKycMessage(text, server.privateKey),
        );
        requests.push({ endpoint, body, headers });
        if (endpoint === 'generate-url') {
          agentPublicKey = body.public_key;
          return {
            status: 200,
            text: encryptKycMessage(
              JSON.stringify({
                metadata: { code: '200', message: 'OK' },
                data: {
                  agent_name: body.agent_name,
                  agent_nik: body.agent_nik,
                  token: 'frame-token-1',
                  url: 'https://kyc.example/frame?token=frame-token-1',
                },
              }),
              agentPublicKey,
            ),
          };
        }
        return {
          status: 200,
          text: encryptKycMessage(
            JSON.stringify({
              metadata: { code: '200', message: 'OK' },
              data: {
                nik: body.data.nik,
                name: body.data.name,
                ihs_number: 'P02478375538',
                challenge_code: 804821,
                created_timestamp: '2026-10-08T10:00:00+07:00',
                expired_timestamp: '2026-10-08T10:05:00+07:00',
              },
            }),
            agentPublicKey,
          ),
        };
      }),
    };
    service = new KycService(
      practitionerRepo as any,
      patientRepo as any,
      client as any,
    );
  });

  it('round-trips the RSA-OAEP + AES-256-GCM envelope', () => {
    const msg = encryptKycMessage('{"a":1}', server.publicKey);
    expect(isEncryptedMessage(msg)).toBe(true);
    expect(msg).toMatch(/^-----BEGIN ENCRYPTED MESSAGE-----\r\n/);
    expect(decryptKycMessage(msg, server.privateKey)).toBe('{"a":1}');
  });

  it('generate-url sends agent + fresh public key encrypted and returns the iframe URL (positive)', async () => {
    const r = await service.generateUrl(1, 77, {});
    expect(r.url).toBe('https://kyc.example/frame?token=frame-token-1');
    expect(r.agentName).toBe('drg. Ratna');
    expect(requests[0].body).toMatchObject({
      agent_name: 'drg. Ratna',
      agent_nik: NIK_AGENT,
    });
    expect(requests[0].body.public_key).toContain('BEGIN PUBLIC KEY');
  });

  it('challenge-code uses the session key + frame token and decrypts the code (positive)', async () => {
    const { sessionId } = await service.generateUrl(1, 77, {});
    const r = await service.challengeCode(1, 77, { sessionId, patientId: 9 });
    expect(r).toEqual({
      name: 'Budi Santoso',
      ihsNumber: 'P02478375538',
      challengeCode: '804821',
      createdAt: '2026-10-08T10:00:00+07:00',
      expiredAt: '2026-10-08T10:05:00+07:00',
    });
    expect(requests[1].headers).toEqual({
      'Content-Type': 'application/json',
      'X-Frame-Token': 'frame-token-1',
    });
    expect(requests[1].body).toEqual({
      metadata: { method: 'request_per_nik' },
      data: { nik: NIK_PATIENT, name: 'Budi Santoso' },
    });
  });

  it('requires an agent NIK when the user has no linked practitioner (negative)', async () => {
    practitionerRepo.findOne.mockResolvedValue(null);
    await expect(service.generateUrl(1, 77, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(client.postKyc).not.toHaveBeenCalled();
  });

  it('rejects a session from another user (negative)', async () => {
    const { sessionId } = await service.generateUrl(1, 77, {});
    await expect(
      service.challengeCode(1, 78, { sessionId, patientId: 9 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.postKyc).toHaveBeenCalledTimes(1);
  });

  it('falls back to the unencrypted JSON format when the envelope is rejected', async () => {
    const impl = client.postKyc.getMockImplementation()!;
    client.postKyc.mockImplementationOnce(async () => {
      await Promise.resolve();
      return {
        status: 400,
        text: JSON.stringify({
          metadata: { code: '400', message: 'Failed to decrypt message' },
        }),
      };
    });
    client.postKyc.mockImplementation(impl);
    const r = await service.generateUrl(1, 77, {});
    expect(r.url).toContain('frame-token-1');
    expect(client.postKyc).toHaveBeenCalledTimes(2);
    expect(client.postKyc.mock.calls[1][3]).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('does not retry when SATUSEHAT rejects the data itself (no double send)', async () => {
    client.postKyc.mockResolvedValueOnce({
      status: 401,
      text: JSON.stringify({ fault: { faultstring: 'Invalid Access Token' } }),
    });
    await expect(service.generateUrl(1, 77, {})).rejects.toThrow(
      /Token SATUSEHAT/,
    );
    expect(client.postKyc).toHaveBeenCalledTimes(1);
  });

  it('challenge-code works without a session using plain JSON (Juknis)', async () => {
    client.postKyc.mockResolvedValueOnce({
      status: 200,
      text: JSON.stringify({
        metadata: { code: '200', message: 'OK' },
        data: { name: 'Budi', ihs_number: 'P1', challenge_code: 123456 },
      }),
    });
    const r = await service.challengeCode(1, 77, {
      nik: NIK_PATIENT,
      name: 'Budi',
    });
    expect(r.challengeCode).toBe('123456');
    expect(client.postKyc.mock.calls[0][3]).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('maps a decrypt failure to a public-key hint', () => {
    expect(
      kycError(400, { metadata: { message: 'Failed to decrypt message' } }),
    ).toMatch(/public key KYC/);
  });

  it('reads an encrypted reply wrapped as a JSON string (challenge-code)', async () => {
    const { sessionId } = await service.generateUrl(1, 77, {});
    client.postKyc.mockImplementationOnce(async () => {
      await Promise.resolve();
      return {
        status: 200,
        text: JSON.stringify(
          encryptKycMessage(
            JSON.stringify({
              metadata: { code: '200' },
              data: { challengeCode: '112233', ihs_number: 'P1' },
            }),
            agentPublicKey,
          ),
        ),
      };
    });
    const r = await service.challengeCode(1, 77, { sessionId, patientId: 9 });
    expect(r.challengeCode).toBe('112233');
  });

  it('explains a 2xx reply without recognisable data (shape only, no values)', async () => {
    const { sessionId } = await service.generateUrl(1, 77, {});
    client.postKyc.mockResolvedValue({
      status: 200,
      text: JSON.stringify({
        metadata: { code: '200' },
        data: { foo: 'SECRET' },
      }),
    });
    await expect(
      service.challengeCode(1, 77, { sessionId, patientId: 9 }),
    ).rejects.toThrow(/JSON \{metadata, data\} data \{foo\}/);
  });
});

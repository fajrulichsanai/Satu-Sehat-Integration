import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SsrmeService } from '../ssrme/ssrme.service';
import { UserRole } from '../../../enums/user-role.enum';

describe('SsrmeService (Juknis SSRME v2.0)', () => {
  const encounter = {
    id: 5,
    clinicId: 1,
    patient: { id: 9, name: 'Tn. Asep Mulyana' },
    practitioner: { id: 3, name: 'drg. Ratna', userId: 77 },
  };
  let encounterRepo: { findOne: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };
  let client: { postSsrme: jest.Mock };
  let service: SsrmeService;
  const owner = { userId: 1, role: UserRole.OWNER };

  beforeEach(() => {
    encounterRepo = { findOne: jest.fn().mockResolvedValue(encounter) };
    clinicRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Klinik Apex',
        satusehatOrgId: '10000004',
      }),
    };
    client = { postSsrme: jest.fn() };
    service = new SsrmeService(
      encounterRepo as any,
      clinicRepo as any,
      client as any,
      {
        patientIhsId: jest.fn().mockResolvedValue('P20395079728'),
        practitionerIhsId: jest.fn().mockResolvedValue('10009880010'),
      } as any,
    );
  });

  const BODY = {
    patient_id: 'P20395079728',
    patient_name: 'Tn. Asep Mulyana',
    practitioner_id: '10009880010',
    practitioner_name: 'drg. Ratna',
    organization_id: '10000004',
    organization_name: 'Klinik Apex',
  };

  it('CHLink sends the six attributes and returns the verification URL (positive)', async () => {
    client.postSsrme.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          shlinkId: 'x',
          verificationUrl: 'https://v',
          expiredAt: '2026-10-05T10:00:00+07:00',
        },
      },
    });
    const res = await service.createConsentLink(1, 5, owner);
    expect(client.postSsrme).toHaveBeenCalledWith(1, 'chl', BODY);
    expect(res).toEqual({
      verificationUrl: 'https://v',
      expiredAt: '2026-10-05T10:00:00+07:00',
    });
  });

  it('emergency consent adds type_medical_summary EMERGENCY (edge)', async () => {
    client.postSsrme.mockResolvedValue({
      status: 200,
      data: { success: true, data: { verificationUrl: 'https://v' } },
    });
    await service.createConsentLink(1, 5, owner, true);
    expect(client.postSsrme).toHaveBeenCalledWith(1, 'chl', {
      ...BODY,
      type_medical_summary: 'EMERGENCY',
    });
  });

  it('SHLink returns the record URL (positive)', async () => {
    client.postSsrme.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          consentId: 'c',
          shlinkUrl: 'https://s',
          expiredAt: 'e',
          partial: false,
          warnings: [],
        },
      },
    });
    expect(await service.openRecord(1, 5, owner)).toEqual({
      shlinkUrl: 'https://s',
      expiredAt: 'e',
      partial: false,
      warnings: [],
    });
    expect(client.postSsrme).toHaveBeenCalledWith(1, 'shl', BODY);
  });

  it('SHLink without consent → 409 CONSENT_REQUIRED (negative)', async () => {
    client.postSsrme.mockResolvedValue({
      status: 403,
      data: {
        success: false,
        code: 403,
        message: 'consent required',
        data: { code: 'CONSENT_REQUIRED' },
      },
    });
    await expect(service.openRecord(1, 5, owner)).rejects.toThrow(
      ConflictException,
    );
  });

  it('maps SSRME errors to readable messages without IDs (negative)', async () => {
    client.postSsrme.mockResolvedValue({
      status: 400,
      data: { success: false, code: 400, data: 'wrong organization' },
    });
    await expect(service.createConsentLink(1, 5, owner)).rejects.toThrow(
      'Organization ID tidak sesuai dengan kredensial SATUSEHAT klinik',
    );
    client.postSsrme.mockResolvedValue({
      status: 400,
      data: {
        success: false,
        message: 'patient with ID P20395079728 not found',
      },
    });
    await expect(service.openRecord(1, 5, owner)).rejects.toThrow(
      new BadRequestException('Pasien tidak ditemukan di SATUSEHAT'),
    );
  });

  it('a doctor can only open records of their own patients (negative)', async () => {
    await expect(
      service.openRecord(1, 5, { userId: 99, role: UserRole.DOKTER }),
    ).rejects.toThrow(ForbiddenException);
    expect(client.postSsrme).not.toHaveBeenCalled();
  });

  it('unknown encounter / unconfigured clinic are rejected (negative)', async () => {
    encounterRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.openRecord(1, 5, owner)).rejects.toThrow(
      NotFoundException,
    );
    clinicRepo.findOne.mockResolvedValueOnce({
      id: 1,
      name: 'X',
      satusehatOrgId: null,
    });
    await expect(service.openRecord(1, 5, owner)).rejects.toThrow(
      'Konfigurasi SATUSEHAT',
    );
  });
});

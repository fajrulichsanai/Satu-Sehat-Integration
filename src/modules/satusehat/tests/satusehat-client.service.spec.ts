import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { SatusehatClientService } from '../satusehat-client.service';
import { Clinic } from '../../clinics/entities/clinic.entity';

describe('SatusehatClientService (deprecated stub)', () => {
  let service: SatusehatClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SatusehatClientService,
        { provide: getRepositoryToken(Clinic), useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'test') } },
      ],
    }).compile();

    service = module.get<SatusehatClientService>(SatusehatClientService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('getAccessToken always throws ServiceUnavailableException (negative)', async () => {
    await expect(service.getAccessToken(1)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('sendFhirResource always throws ServiceUnavailableException (negative)', async () => {
    await expect(
      service.sendFhirResource(1, 'POST', '/Patient', {}),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('searchPatientByNik always throws ServiceUnavailableException (negative)', async () => {
    await expect(
      service.searchPatientByNik(1, '1234567890123456'),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

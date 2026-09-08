import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { SatusehatFhirService } from '../satusehat-fhir.service';
import { SatusehatClientService } from '../satusehat-client.service';

describe('SatusehatFhirService', () => {
  let service: SatusehatFhirService;
  let client: { sendFhirResource: jest.Mock };

  const divisiData = {
    orgId: 'ORG1',
    name: 'Divisi A',
    phone: '0800',
    email: 'a@x.com',
    website: 'https://x.com',
    address: 'Jl. A',
    city: 'Jakarta',
    postalCode: '12345',
    provinceCode: '31',
    cityCode: '3171',
    districtCode: '317101',
    villageCode: '3171011001',
  };

  const poliData = {
    orgId: 'ORG1',
    name: 'Poli Gigi',
    description: 'Poli gigi dan mulut',
    phone: '0800',
    email: 'a@x.com',
    website: 'https://x.com',
    latitude: -6.2,
    longitude: 106.8,
    parentOrgId: 'PARENT1',
  };

  beforeEach(async () => {
    client = { sendFhirResource: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SatusehatFhirService,
        { provide: SatusehatClientService, useValue: client },
      ],
    }).compile();

    service = module.get<SatusehatFhirService>(SatusehatFhirService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('createDivisiOrganization', () => {
    it('returns the created Organization id on 201 (positive)', async () => {
      client.sendFhirResource.mockResolvedValue({
        status: 201,
        data: { id: 'org-123' },
      });

      const result = await service.createDivisiOrganization(1, divisiData);

      expect(result).toBe('org-123');
      expect(client.sendFhirResource).toHaveBeenCalledWith(
        1,
        'POST',
        'Organization',
        expect.objectContaining({ resourceType: 'Organization' }),
      );
    });

    it('throws ServiceUnavailableException on a non-201 status (negative)', async () => {
      client.sendFhirResource.mockResolvedValue({ status: 400, data: null });
      await expect(
        service.createDivisiOrganization(1, divisiData),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when the downstream client throws (negative)', async () => {
      client.sendFhirResource.mockRejectedValue(new Error('down'));
      await expect(
        service.createDivisiOrganization(1, divisiData),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('createLayananOrganization', () => {
    it('returns the created Organization id on 201 (positive)', async () => {
      client.sendFhirResource.mockResolvedValue({
        status: 201,
        data: { id: 'org-456' },
      });

      const result = await service.createLayananOrganization(1, {
        ...divisiData,
        parentOrgId: 'PARENT1',
      });

      expect(result).toBe('org-456');
    });

    it('throws ServiceUnavailableException when response has no id (negative)', async () => {
      client.sendFhirResource.mockResolvedValue({ status: 201, data: {} });
      await expect(
        service.createLayananOrganization(1, {
          ...divisiData,
          parentOrgId: 'PARENT1',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('createPoliLocation', () => {
    it('returns the created Location id on 201 (positive)', async () => {
      client.sendFhirResource.mockResolvedValue({
        status: 201,
        data: { id: 'loc-789' },
      });

      const result = await service.createPoliLocation(1, poliData);

      expect(result).toBe('loc-789');
      expect(client.sendFhirResource).toHaveBeenCalledWith(
        1,
        'POST',
        'Location',
        expect.objectContaining({ resourceType: 'Location' }),
      );
    });

    it('throws ServiceUnavailableException on a non-201 status (negative)', async () => {
      client.sendFhirResource.mockResolvedValue({ status: 500, data: null });
      await expect(service.createPoliLocation(1, poliData)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});

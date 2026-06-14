import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SatusehatClientService } from './satusehat-client.service';

interface OrganizationResponse {
  id?: string;
  resourceType: string;
}

interface LocationResponse {
  id?: string;
  resourceType: string;
}

@Injectable()
export class SatusehatFhirService {
  private readonly logger = new Logger(SatusehatFhirService.name);

  constructor(private readonly satusehatClientService: SatusehatClientService) {}

  /**
   * Create Organization for Divisi Pelayanan Medik dan Penunjang
   */
  async createDivisiOrganization(
    clinicId: number,
    data: {
      orgId: string;
      name: string;
      phone: string;
      email: string;
      website: string;
      address: string;
      city: string;
      postalCode: string;
      provinceCode: string;
      cityCode: string;
      districtCode: string;
      villageCode: string;
    },
  ): Promise<string> {
    const payload = {
      resourceType: 'Organization',
      active: true,
      identifier: [
        {
          use: 'official',
          system: `http://sys-ids.kemkes.go.id/organization/${data.orgId}`,
          value: `DIVISI-${data.orgId}`,
        },
      ],
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'dept',
              display: 'Hospital Department',
            },
          ],
        },
      ],
      name: data.name,
      telecom: [
        { system: 'phone', value: data.phone, use: 'work' },
        { system: 'email', value: data.email, use: 'work' },
        { system: 'url', value: data.website, use: 'work' },
      ],
      address: [
        {
          use: 'work',
          type: 'both',
          line: [data.address],
          city: data.city,
          postalCode: data.postalCode,
          country: 'ID',
          extension: [
            {
              url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode',
              extension: [
                { url: 'province', valueCode: data.provinceCode },
                { url: 'city', valueCode: data.cityCode },
                { url: 'district', valueCode: data.districtCode },
                { url: 'village', valueCode: data.villageCode },
              ],
            },
          ],
        },
      ],
      partOf: {
        reference: `Organization/${data.orgId}`,
        display: data.name,
      },
    };

    try {
      const response = await this.satusehatClientService.sendFhirResource(
        clinicId,
        'POST',
        'Organization',
        payload,
      );

      if (response.status === 201 && response.data?.id) {
        return response.data.id;
      }

      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      this.logger.error(
        `Failed to create Divisi Organization: ${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Gagal membuat Organization di Satu Sehat',
      );
    }
  }

  /**
   * Create Organization for Layanan Gigi dan Mulut
   */
  async createLayananOrganization(
    clinicId: number,
    data: {
      orgId: string;
      name: string;
      phone: string;
      email: string;
      website: string;
      address: string;
      city: string;
      postalCode: string;
      provinceCode: string;
      cityCode: string;
      districtCode: string;
      villageCode: string;
      parentOrgId: string;
    },
  ): Promise<string> {
    const payload = {
      resourceType: 'Organization',
      active: true,
      identifier: [
        {
          use: 'official',
          system: `http://sys-ids.kemkes.go.id/organization/${data.orgId}`,
          value: `LAYANAN-GIGI-${data.orgId}`,
        },
      ],
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'prov',
              display: 'Healthcare Provider',
            },
          ],
        },
      ],
      name: data.name,
      telecom: [
        { system: 'phone', value: data.phone, use: 'work' },
        { system: 'email', value: data.email, use: 'work' },
        { system: 'url', value: data.website, use: 'work' },
      ],
      address: [
        {
          use: 'work',
          type: 'both',
          line: [data.address],
          city: data.city,
          postalCode: data.postalCode,
          country: 'ID',
          extension: [
            {
              url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode',
              extension: [
                { url: 'province', valueCode: data.provinceCode },
                { url: 'city', valueCode: data.cityCode },
                { url: 'district', valueCode: data.districtCode },
                { url: 'village', valueCode: data.villageCode },
              ],
            },
          ],
        },
      ],
      partOf: {
        reference: `Organization/${data.parentOrgId}`,
        display: 'Divisi Pelayanan Medik dan Penunjang',
      },
    };

    try {
      const response = await this.satusehatClientService.sendFhirResource(
        clinicId,
        'POST',
        'Organization',
        payload,
      );

      if (response.status === 201 && response.data?.id) {
        return response.data.id;
      }

      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      this.logger.error(
        `Failed to create Layanan Organization: ${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Gagal membuat Organization Layanan di Satu Sehat',
      );
    }
  }

  /**
   * Create Location for Poli Gigi dan Mulut
   */
  async createPoliLocation(
    clinicId: number,
    data: {
      orgId: string;
      name: string;
      description: string;
      phone: string;
      email: string;
      website: string;
      latitude: number;
      longitude: number;
      parentOrgId: string;
    },
  ): Promise<string> {
    const payload = {
      resourceType: 'Location',
      identifier: [
        {
          system: `http://sys-ids.kemkes.go.id/location/${data.orgId}`,
          value: `POLI-GIGI-${data.orgId}`,
        },
      ],
      status: 'active',
      name: data.name,
      description: data.description,
      mode: 'instance',
      telecom: [
        { system: 'phone', value: data.phone, use: 'work' },
        { system: 'email', value: data.email, use: 'work' },
        { system: 'url', value: data.website, use: 'work' },
      ],
      physicalType: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
            code: 'ro',
            display: 'Room',
          },
        ],
      },
      position: {
        longitude: data.longitude,
        latitude: data.latitude,
        altitude: 0,
      },
      managingOrganization: {
        reference: `Organization/${data.parentOrgId}`,
      },
      extension: [
        {
          url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/LocationServiceClass',
          valueCodeableConcept: {
            coding: [
              {
                system:
                  'http://terminology.kemkes.go.id/CodeSystem/locationServiceClass-Outpatient',
                code: 'reguler',
                display: 'Kelas Reguler',
              },
            ],
          },
        },
      ],
    };

    try {
      const response = await this.satusehatClientService.sendFhirResource(
        clinicId,
        'POST',
        'Location',
        payload,
      );

      if (response.status === 201 && response.data?.id) {
        return response.data.id;
      }

      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error) {
      this.logger.error(`Failed to create Poli Location: ${error.message}`);
      throw new ServiceUnavailableException(
        'Gagal membuat Location di Satu Sehat',
      );
    }
  }
}

import { Patient } from '../../patients/entities/patient.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

export class FhirMapper {
  static toFhirPatient(patient: Patient, orgId: string): object {
    return {
      resourceType: 'Patient',
      meta: {
        profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Patient'],
      },
      identifier: [
        ...(patient.nik
          ? [
              {
                system: 'https://fhir.kemkes.go.id/id/nik',
                value: patient.nik,
              },
            ]
          : []),
      ],
      name: [{ use: 'official', text: patient.name }],
      telecom: patient.phone ? [{ system: 'phone', value: patient.phone }] : [],
      gender: patient.gender === 'male' ? 'male' : 'female',
      birthDate: patient.birthDate?.toISOString().split('T')[0],
      address: patient.address
        ? [{ use: 'home', text: patient.address, city: patient.city }]
        : [],
      managingOrganization: { reference: `Organization/${orgId}` },
    };
  }

  static toFhirEncounter(
    encounter: Encounter,
    orgId: string,
    locationRef?: string,
  ): object {
    return {
      resourceType: 'Encounter',
      meta: {
        profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Encounter'],
      },
      status: this.mapEncounterStatus(encounter.status),
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      subject: { reference: `Patient/${encounter.patientId}` },
      participant: encounter.practitionerId
        ? [
            {
              individual: {
                reference: `Practitioner/${encounter.practitionerId}`,
              },
            },
          ]
        : [],
      period: {
        start: encounter.arrivedTime?.toISOString(),
        end: encounter.finishedTime?.toISOString(),
      },
      location: locationRef
        ? [{ location: { reference: `Location/${locationRef}` } }]
        : [],
      serviceProvider: { reference: `Organization/${orgId}` },
    };
  }

  private static mapEncounterStatus(status: string): string {
    const map: Record<string, string> = {
      arrived: 'arrived',
      in_progress: 'in-progress',
      finished: 'finished',
      cancelled: 'cancelled',
    };
    return map[status] || 'unknown';
  }
}

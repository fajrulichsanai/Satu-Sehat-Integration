import { Patient } from '../../../entities/patient.entity';
import { Encounter } from '../../../entities/encounter.entity';
import { Diagnosis } from '../../../entities/diagnosis.entity';
import { Procedure } from '../../../entities/procedure.entity';
import { VitalSign } from '../../../entities/vital-sign.entity';
import { Prescription } from '../../../entities/prescription.entity';
import { Allergy } from '../../../entities/allergy.entity';

export class FhirMapper {
  static toFhirPatient(patient: Patient, orgId: string): object {
    return {
      resourceType: 'Patient',
      meta: { profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Patient'] },
      identifier: [
        ...(patient.nik
          ? [{
              system: 'https://fhir.kemkes.go.id/id/nik',
              value: patient.nik,
            }]
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

  static toFhirEncounter(encounter: Encounter, orgId: string, locationRef?: string): object {
    return {
      resourceType: 'Encounter',
      meta: { profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Encounter'] },
      status: this.mapEncounterStatus(encounter.status),
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      subject: { reference: `Patient/${encounter.patientId}` },
      participant: encounter.practitionerId
        ? [{ individual: { reference: `Practitioner/${encounter.practitionerId}` } }]
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

  static toFhirCondition(diagnosis: Diagnosis, patientSatusehatId: string, encounterSatusehatId: string): object {
    return {
      resourceType: 'Condition',
      meta: { profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Condition'] },
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: diagnosis.clinicalStatus,
        }],
      },
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-category',
          code: diagnosis.category,
        }],
      }],
      code: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: diagnosis.icd10Code,
          display: diagnosis.icd10Display,
        }],
      },
      subject: { reference: `Patient/${patientSatusehatId}` },
      encounter: { reference: `Encounter/${encounterSatusehatId}` },
      onsetDateTime: diagnosis.onsetDate?.toISOString(),
      note: diagnosis.note ? [{ text: diagnosis.note }] : [],
    };
  }

  static toFhirProcedure(procedure: Procedure, patientSatusehatId: string, encounterSatusehatId: string): object {
    return {
      resourceType: 'Procedure',
      meta: { profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Procedure'] },
      status: procedure.status,
      code: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-9-cm',
          code: procedure.icd9Code,
          display: procedure.procedureName,
        }],
      },
      subject: { reference: `Patient/${patientSatusehatId}` },
      encounter: { reference: `Encounter/${encounterSatusehatId}` },
      performedPeriod: {
        start: procedure.performedStart?.toISOString(),
        end: procedure.performedEnd?.toISOString(),
      },
      note: procedure.note ? [{ text: procedure.note }] : [],
    };
  }

  static toFhirObservation(vitalSign: VitalSign, patientSatusehatId: string, encounterSatusehatId: string): object {
    return {
      resourceType: 'Observation',
      meta: { profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Observation'] },
      status: 'final',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: vitalSign.loincCode,
          display: vitalSign.name,
        }],
      },
      subject: { reference: `Patient/${patientSatusehatId}` },
      encounter: { reference: `Encounter/${encounterSatusehatId}` },
      effectiveDateTime: vitalSign.recordedAt?.toISOString(),
      valueQuantity: {
        value: vitalSign.value,
        unit: vitalSign.unit,
      },
      interpretation: vitalSign.isOutOfRange
        ? [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' }] }]
        : [],
    };
  }

  static toFhirMedicationRequest(
    prescription: Prescription,
    patientSatusehatId: string,
    encounterSatusehatId: string,
    orgId: string,
  ): object {
    return {
      resourceType: 'MedicationRequest',
      meta: { profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationRequest'] },
      status: prescription.status === 'dispensed' ? 'completed' : 'active',
      intent: 'order',
      medicationReference: { reference: `Medication/${prescription.medicationId}` },
      subject: { reference: `Patient/${patientSatusehatId}` },
      encounter: { reference: `Encounter/${encounterSatusehatId}` },
      requester: { reference: `Organization/${orgId}` },
      dosageInstruction: [{
        text: prescription.dosageInstruction,
        timing: prescription.duration
          ? { repeat: { duration: prescription.duration, durationUnit: prescription.durationUnit } }
          : undefined,
      }],
      dispenseRequest: { quantity: { value: prescription.quantity } },
      note: prescription.note ? [{ text: prescription.note }] : [],
    };
  }

  static toFhirAllergyIntolerance(allergy: Allergy, patientSatusehatId: string): object {
    return {
      resourceType: 'AllergyIntolerance',
      meta: { profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/AllergyIntolerance'] },
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }],
      },
      criticality: allergy.tingkat === 'high' ? 'high' : allergy.tingkat === 'moderate' ? 'unable-to-assess' : 'low',
      code: { text: allergy.substansi },
      patient: { reference: `Patient/${patientSatusehatId}` },
      reaction: [{ description: allergy.reaksi }],
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

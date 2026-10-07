import { ClinicalRecordsMapper } from '../fhir/clinical-records-mapper';
import { FhirContext } from '../fhir/fhir-mapper';
import { PatientCondition } from '../../clinical-records/entities/patient-condition.entity';
import { ClinicalObservation } from '../../clinical-records/entities/clinical-observation.entity';

const ctx: FhirContext = {
  orgId: '100025702',
  patient: { id: 'P02478375538', name: 'Diana Smith' },
  practitioner: { id: '10009880728', name: 'dr. Budi' },
  location: { id: 'LOC-UUID', name: 'Poli Umum' },
  encounterId: 'ENC-UUID',
};

const condition = (over: Partial<PatientCondition> = {}) =>
  ({
    id: 3,
    codeSystem: 'icd10',
    code: 'I10',
    display: 'Essential (primary) hypertension',
    nameId: 'Hipertensi esensial',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    severity: 'moderate',
    onsetDate: '2020-05-01',
    abatementDate: null,
    note: null,
    createdAt: new Date('2025-01-02T03:04:05.678Z'),
    ...over,
  }) as PatientCondition;

const observation = (over: Partial<ClinicalObservation> = {}) =>
  ({
    id: 8,
    observationKey: 'bmi',
    valueNumber: 24.5,
    valueCode: null,
    effectiveAt: new Date('2025-01-02T03:00:00Z'),
    note: null,
    status: 'final',
    ...over,
  }) as ClinicalObservation;

describe('ClinicalRecordsMapper', () => {
  it('maps a problem-list Condition with statuses, severity and onset (positive)', () => {
    const { localType, localId, resource } =
      ClinicalRecordsMapper.toProblemCondition(condition(), ctx);
    expect(localType).toBe('cond_problem');
    expect(localId).toBe(3);
    expect(resource).toMatchObject({
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
            display: 'Confirmed',
          },
        ],
      },
      category: [{ coding: [{ code: 'problem-list-item' }] }],
      severity: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '6736007',
            display: 'Moderate',
          },
        ],
      },
      code: {
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: 'I10',
            display: 'Essential (primary) hypertension',
          },
        ],
        text: 'Hipertensi esensial',
      },
      subject: { reference: 'Patient/P02478375538' },
      encounter: { reference: 'Encounter/ENC-UUID' },
      onsetDateTime: '2020-04-30T17:00:00+00:00',
      recordedDate: '2025-01-02T03:04:05+00:00',
      recorder: { reference: 'Practitioner/10009880728' },
    });
    expect(resource.abatementDateTime).toBeUndefined();
  });

  it('sends abatement only for resolved-type statuses (FHIR con-4) (edge)', () => {
    const resolved = ClinicalRecordsMapper.toProblemCondition(
      condition({ clinicalStatus: 'resolved', abatementDate: '2025-01-01' }),
      ctx,
    ).resource;
    expect(resolved.abatementDateTime).toBe('2024-12-31T17:00:00+00:00');
    const active = ClinicalRecordsMapper.toProblemCondition(
      condition({ abatementDate: '2025-01-01' }),
      ctx,
    ).resource;
    expect(active.abatementDateTime).toBeUndefined();
  });

  it('drops clinicalStatus for entered-in-error (FHIR con-5) and keeps old onsets as a note (edge)', () => {
    const removed = ClinicalRecordsMapper.toProblemCondition(
      condition({
        verificationStatus: 'entered-in-error',
        onsetDate: '2010-03-04',
      }),
      ctx,
    ).resource;
    expect(removed.clinicalStatus).toBeUndefined();
    expect(removed.verificationStatus.coding[0]).toMatchObject({
      code: 'entered-in-error',
      display: 'Entered in Error',
    });
    expect(removed.onsetDateTime).toBeUndefined();
    expect(removed.note).toEqual([{ text: 'Mulai sejak 04-03-2010' }]);
  });

  it('maps a quantity Observation with LOINC + UCUM from the catalog (positive)', () => {
    const { localType, resource } = ClinicalRecordsMapper.toObservation(
      observation(),
      ctx,
    );
    expect(localType).toBe('clin_obs_vital-signs');
    expect(resource).toMatchObject({
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system:
                'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '39156-5',
            display: 'Body mass index (BMI) [Ratio]',
          },
        ],
      },
      performer: [{ reference: 'Practitioner/10009880728' }],
      encounter: { reference: 'Encounter/ENC-UUID' },
      effectiveDateTime: '2025-01-02T03:00:00+00:00',
      valueQuantity: {
        value: 24.5,
        unit: 'kg/m2',
        system: 'http://unitsofmeasure.org',
        code: 'kg/m2',
      },
    });
  });

  it('maps a coded Observation to a SNOMED answer and supports entered-in-error (positive)', () => {
    const { localType, resource } = ClinicalRecordsMapper.toObservation(
      observation({
        observationKey: 'smoking',
        valueNumber: null,
        valueCode: '8517006',
        status: 'entered-in-error',
      }),
      ctx,
    );
    expect(localType).toBe('clin_obs_social-history');
    expect(resource.status).toBe('entered-in-error');
    expect(resource.valueCodeableConcept.coding[0]).toEqual({
      system: 'http://snomed.info/sct',
      code: '8517006',
      display: 'Former smoker',
    });
  });

  it('refuses to build an Observation with an unknown key or missing value (negative)', () => {
    expect(() =>
      ClinicalRecordsMapper.toObservation(
        observation({ observationKey: 'x' }),
        ctx,
      ),
    ).toThrow('tidak dikenal');
    expect(() =>
      ClinicalRecordsMapper.toObservation(
        observation({ valueNumber: null }),
        ctx,
      ),
    ).toThrow('kosong');
  });
});

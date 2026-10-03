import { FhirMapper, FhirContext, fhirDateTime } from '../fhir/fhir-mapper';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { VitalSign } from '../../vital-sign/entities/vital-sign.entity';
import { Procedure } from '../../procedures/entities/procedure.entity';
import { Diagnosis } from '../../diagnoses/entities/diagnosis.entity';
import {
  Anamnesis,
  BloodType,
  PregnancyStatus,
  Rhesus,
} from '../../anamnesis/entities/anamnesis.entity';

const ctx: FhirContext = {
  orgId: '100025702',
  patient: { id: 'P02478375538', name: 'Diana Smith' },
  practitioner: { id: '10009880728', name: 'drg. Budi' },
  location: { id: 'LOC-UUID', name: 'Poli Gigi 1' },
  encounterId: 'ENC-UUID',
};

describe('FhirMapper (Playbook RME Rawat Jalan / Use Case Gigi)', () => {
  it('fhirDateTime memakai format UTC +00:00 tanpa milidetik', () => {
    expect(fhirDateTime(new Date('2026-10-01T02:00:00.123Z'))).toBe(
      '2026-10-01T02:00:00+00:00',
    );
    expect(fhirDateTime(null)).toBeUndefined();
  });

  it('Encounter finished: statusHistory lengkap, diagnosis DD berperingkat, dischargeDisposition', () => {
    const enc = Object.assign(new Encounter(), {
      id: 41,
      status: 'finished',
      arrivedTime: new Date('2026-10-01T02:00:00Z'),
      inProgressTime: new Date('2026-10-01T02:15:00Z'),
      finishedTime: new Date('2026-10-01T03:00:00Z'),
    });
    const r = FhirMapper.toEncounter(enc, ctx, [
      { conditionId: 'C1', display: 'Acute periodontitis' },
      { conditionId: 'C2', display: 'Periapical abscess' },
    ]) as any;

    expect(r.id).toBe('ENC-UUID');
    expect(r.identifier[0]).toEqual({
      system: 'http://sys-ids.kemkes.go.id/encounter/100025702',
      value: '41',
    });
    expect(r.class.code).toBe('AMB');
    expect(r.subject.reference).toBe('Patient/P02478375538');
    expect(r.participant[0].individual.reference).toBe(
      'Practitioner/10009880728',
    );
    expect(r.participant[0].type[0].coding[0].code).toBe('ATND');
    expect(r.statusHistory.map((h: any) => h.status)).toEqual([
      'arrived',
      'in-progress',
      'finished',
    ]);
    expect(r.statusHistory[0].period).toEqual({
      start: '2026-10-01T02:00:00+00:00',
      end: '2026-10-01T02:15:00+00:00',
    });
    expect(
      r.diagnosis.map((d: any) => [
        d.condition.reference,
        d.rank,
        d.use.coding[0].code,
      ]),
    ).toEqual([
      ['Condition/C1', 1, 'DD'],
      ['Condition/C2', 2, 'DD'],
    ]);
    expect(r.hospitalization.dischargeDisposition.coding[0].code).toBe('home');
    expect(r.serviceProvider.reference).toBe('Organization/100025702');
  });

  it('Encounter arrived (kunjungan baru): tanpa diagnosis/hospitalization', () => {
    const enc = Object.assign(new Encounter(), {
      id: 1,
      status: 'arrived',
      arrivedTime: new Date('2026-10-01T02:00:00Z'),
    });
    const r = FhirMapper.toEncounter(enc, {
      ...ctx,
      encounterId: undefined,
    }) as any;
    expect(r.id).toBeUndefined();
    expect(r.status).toBe('arrived');
    expect(r.statusHistory).toEqual([
      {
        status: 'arrived',
        period: { start: '2026-10-01T02:00:00+00:00', end: undefined },
      },
    ]);
    expect(r.diagnosis).toBeUndefined();
    expect(r.hospitalization).toBeUndefined();
  });

  it('Observation tanda vital memakai satuan UCUM', () => {
    const vs = Object.assign(new VitalSign(), {
      loincCode: '8310-5',
      name: 'Suhu Tubuh',
      value: '36.80' as unknown as number,
      unit: '°C',
      recordedAt: new Date('2026-10-01T02:20:00Z'),
    });
    const r = FhirMapper.toVitalSignObservation(vs, ctx) as any;
    expect(r.category[0].coding[0].code).toBe('vital-signs');
    expect(r.code.coding[0]).toEqual({
      system: 'http://loinc.org',
      code: '8310-5',
      display: 'Body temperature',
    });
    expect(r.valueQuantity).toEqual({
      value: 36.8,
      unit: 'C',
      system: 'http://unitsofmeasure.org',
      code: 'Cel',
    });
    expect(r.performer[0].reference).toBe('Practitioner/10009880728');
    expect(r.encounter.reference).toBe('Encounter/ENC-UUID');
  });

  it('Anamnesis → golongan darah, rhesus, status kehamilan', () => {
    const a = Object.assign(new Anamnesis(), {
      id: 5,
      golonganDarah: BloodType.A,
      rhesus: Rhesus.POSITIVE,
      statusKehamilan: PregnancyStatus.NOT_PREGNANT,
      createdAt: new Date('2026-10-01T02:10:00Z'),
    });
    const r = FhirMapper.toAnamnesisObservations(a, ctx) as any[];
    expect(
      r.map((o) => [
        o.localType,
        o.resource.code.coding[0].code,
        o.resource.valueCodeableConcept.coding[0].code,
      ]),
    ).toEqual([
      ['anamnesis_blood_type', '883-9', 'LA19710-5'],
      ['anamnesis_rhesus', '10331-7', 'LA6576-8'],
      ['anamnesis_pregnancy', '82810-3', '60001007'],
    ]);
  });

  it('Procedure terapeutik: ICD-9-CM, performer, reasonCode ICD-10', () => {
    const p = Object.assign(new Procedure(), {
      icd9Code: '96.54',
      procedureName: 'Dental scaling',
      status: 'completed',
      toothNumber: '16',
      performedStart: new Date('2026-10-01T02:30:00Z'),
    });
    const reason = Object.assign(new Diagnosis(), {
      icd10Code: 'K05.2',
      icd10Display: 'Acute periodontitis',
    });
    const r = FhirMapper.toProcedure(p, ctx, reason) as any;
    expect(r.category.coding[0].code).toBe('277132007');
    expect(r.code.coding[0].system).toBe('http://hl7.org/fhir/sid/icd-9-cm');
    expect(r.performer[0].actor.reference).toBe('Practitioner/10009880728');
    expect(r.reasonCode[0].coding[0].code).toBe('K05.2');
    expect(r.performedPeriod).toEqual({
      start: '2026-10-01T02:30:00+00:00',
      end: '2026-10-01T02:30:00+00:00',
    });
  });
});

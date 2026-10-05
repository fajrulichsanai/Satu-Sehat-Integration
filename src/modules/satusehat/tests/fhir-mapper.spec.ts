import {
  FhirContext,
  FhirMapper,
  durationDays,
  fhirDateTime,
  leadingNumber,
} from '../fhir/fhir-mapper';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { PhysicalExamination } from '../../physical-examination/entities/physical-examination.entity';
import { DentalExamination } from '../../dental-examination/entities/dental-examination.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription-item.entity';
import { KfaProduct } from '../kfa/kfa.service';

const ctx: FhirContext = {
  orgId: '100025702',
  patient: { id: 'P02478375538', name: 'Diana Smith' },
  practitioner: { id: '10009880728', name: 'drg. Budi' },
  location: { id: 'LOC-UUID', name: 'Poli Gigi 1' },
  encounterId: 'ENC-UUID',
};

const KFA: KfaProduct = {
  kfaCode: '93002013',
  name: 'Clindamycin Hydrochloride 300 mg Kapsul (CLINIUM 300)',
  active: true,
  group: 'farmasi',
  dosageForm: { code: 'BS019', name: 'Kapsul' },
  route: { code: 'O', name: 'Oral' },
  uom: 'Kapsul',
  manufacturer: null,
  nie: null,
  generic: false,
  template: null,
  activeIngredients: [
    { kfaCode: '91000598', name: 'CLINDAMYCIN', strength: '300 mg' },
  ],
};

describe('FhirMapper (Playbook RME Rawat Jalan / Use Case Gigi)', () => {
  it('fhirDateTime uses UTC +00:00 without milliseconds', () => {
    expect(fhirDateTime(new Date('2026-10-01T02:00:00.123Z'))).toBe(
      '2026-10-01T02:00:00+00:00',
    );
    expect(fhirDateTime(null)).toBeUndefined();
  });

  it('parses free-text quantity and duration', () => {
    expect(leadingNumber('15 tablet')).toBe(15);
    expect(leadingNumber('-')).toBeUndefined();
    expect(durationDays('5 hari')).toBe(5);
    expect(durationDays('2 minggu')).toBe(14);
    expect(durationDays('sampai habis')).toBeUndefined();
  });

  it('Encounter finished: full statusHistory, ranked DD diagnoses, dischargeDisposition', () => {
    const enc = Object.assign(new Encounter(), {
      id: 41,
      status: 'finished',
      arrivedTime: new Date('2026-10-01T02:00:00Z'),
      inProgressTime: new Date('2026-10-01T02:15:00Z'),
      finishedTime: new Date('2026-10-01T03:00:00Z'),
    });
    const r = FhirMapper.toEncounter(enc, ctx, [
      { conditionId: 'C1', display: 'Karies dentin' },
      { conditionId: 'C2', display: 'Gingivitis' },
    ]) as any;
    expect(r.identifier[0]).toEqual({
      system: 'http://sys-ids.kemkes.go.id/encounter/100025702',
      value: '41',
    });
    expect(r.class.code).toBe('AMB');
    expect(r.subject.reference).toBe('Patient/P02478375538');
    expect(r.participant[0].type[0].coding[0].code).toBe('ATND');
    expect(r.statusHistory.map((h: any) => h.status)).toEqual([
      'arrived',
      'in-progress',
      'finished',
    ]);
    expect(
      r.diagnosis.map((d: any) => [d.condition.reference, d.rank]),
    ).toEqual([
      ['Condition/C1', 1],
      ['Condition/C2', 2],
    ]);
    expect(r.hospitalization.dischargeDisposition.coding[0].code).toBe('home');
  });

  it('vital signs: one Observation per filled field, UCUM units (positive)', () => {
    const pe = Object.assign(new PhysicalExamination(), {
      id: 7,
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      temperature: '36.8',
      pulseRate: null,
      updatedAt: new Date('2026-10-01T02:20:00Z'),
    });
    const r = FhirMapper.toVitalSignObservations(pe, ctx);
    expect(r.map((o) => o.localType)).toEqual([
      'pe_8480-6',
      'pe_8462-4',
      'pe_8310-5',
    ]);
    const temp = r[2].resource;
    expect(temp.valueQuantity).toEqual({
      value: 36.8,
      unit: 'C',
      system: 'http://unitsofmeasure.org',
      code: 'Cel',
    });
    expect(temp.category[0].coding[0].code).toBe('vital-signs');
    expect(temp.performer[0].reference).toBe('Practitioner/10009880728');
  });

  it('OHIS: DI-S, CI-S and total OHI-S with clinical-term codes', () => {
    const de = Object.assign(new DentalExamination(), {
      id: 9,
      ohisDebris: '1.2',
      ohisCalculus: '0.5',
      updatedAt: new Date('2026-10-01T02:25:00Z'),
    });
    const r = FhirMapper.toOhisObservations(de, ctx);
    expect(
      r.map((o) => [
        o.resource.code.coding[0].code,
        o.resource.valueQuantity.value,
      ]),
    ).toEqual([
      ['OC000056', 1.2],
      ['OC000057', 0.5],
      ['OC000058', 1.7],
    ]);
  });

  it('Condition from SOAP diagnosis keeps the code system (ICD-10 / SNOMED)', () => {
    const icd = FhirMapper.toCondition(
      {
        system: 'icd10',
        code: 'K02.1',
        display: 'Caries of dentine',
        nameId: 'Karies dentin',
        primary: true,
      },
      new Date('2026-10-01T02:30:00Z'),
      ctx,
    ) as any;
    expect(icd.code.coding[0]).toEqual({
      system: 'http://hl7.org/fhir/sid/icd-10',
      code: 'K02.1',
      display: 'Caries of dentine',
    });
    expect(icd.code.text).toBe('Karies dentin');
    expect(icd.category[0].coding[0].code).toBe('encounter-diagnosis');

    const snomed = FhirMapper.toCondition(
      {
        system: 'snomed',
        code: '80967001',
        display: 'Dental caries',
        primary: false,
      },
      new Date(),
      ctx,
    ) as any;
    expect(snomed.code.coding[0].system).toBe('http://snomed.info/sct');
  });

  it('Procedure from a billing item with an ICD-9-CM tarif', () => {
    const enc = Object.assign(new Encounter(), {
      inProgressTime: new Date('2026-10-01T02:15:00Z'),
      finishedTime: new Date('2026-10-01T03:00:00Z'),
    });
    const r = FhirMapper.toProcedure(
      { name: 'Scaling RA', tarif: { kodeIcd9: '96.54', name: 'Scaling' } },
      enc,
      ctx,
      {
        system: 'icd10',
        code: 'K05.1',
        display: 'Chronic gingivitis',
        primary: true,
      },
    ) as any;
    expect(r.code.coding[0]).toEqual({
      system: 'http://hl7.org/fhir/sid/icd-9-cm',
      code: '96.54',
      display: 'Scaling',
    });
    expect(r.code.text).toBe('Scaling RA');
    expect(r.reasonCode[0].coding[0].code).toBe('K05.1');
    expect(r.performer[0].actor.reference).toBe('Practitioner/10009880728');
  });

  it('Medication + MedicationRequest from a KFA-coded prescription item', () => {
    const med = FhirMapper.toMedication(KFA, ctx, 'RX-5') as any;
    expect(med.code.coding[0]).toEqual({
      system: 'http://sys-ids.kemkes.go.id/kfa',
      code: '93002013',
      display: KFA.name,
    });
    expect(med.form.coding[0].code).toBe('BS019');
    expect(med.ingredient[0].itemCodeableConcept.coding[0].code).toBe(
      '91000598',
    );
    expect(med.extension[0].valueCodeableConcept.coding[0].code).toBe('NC');

    const item = Object.assign(new PrescriptionItem(), {
      id: 5,
      drugName: 'Clindamycin 300mg',
      dosage: '1 kapsul',
      frequency: '3x sehari',
      duration: '5 hari',
      quantity: '15 kapsul',
      instructions: 'Sesudah makan',
      createdAt: new Date('2026-10-01T02:40:00Z'),
    });
    const enc = Object.assign(new Encounter(), { id: 41, status: 'finished' });
    const rq = FhirMapper.toMedicationRequest(
      item,
      KFA,
      'MED-1',
      enc,
      ctx,
    ) as any;
    expect(rq.identifier[1].value).toBe('41-5');
    expect(rq.medicationReference.reference).toBe('Medication/MED-1');
    expect(rq.dosageInstruction[0].text).toBe(
      '1 kapsul, 3x sehari, selama 5 hari',
    );
    expect(rq.dosageInstruction[0].patientInstruction).toBe('Sesudah makan');
    expect(rq.dosageInstruction[0].route.coding[0].code).toBe('O');
    expect(rq.dispenseRequest.quantity).toEqual({ value: 15, unit: 'Kapsul' });
    expect(rq.dispenseRequest.expectedSupplyDuration.value).toBe(5);
    expect(rq.requester.reference).toBe('Practitioner/10009880728');

    // Resep sederhana: aturan pakai terstruktur + numero
    const simple = Object.assign(new PrescriptionItem(), {
      id: 6,
      drugName: 'Clindamycin 300mg',
      numero: 15,
      quantity: '15',
      signa: {
        timesPerDay: 3,
        amount: 1,
        unit: 'CAP',
        when: 'PC',
        route: 'O',
        latin: 'S 3 dd caps I p.c.',
        text: '3 x sehari 1 kapsul sesudah makan',
      },
      routeCode: 'O',
      createdAt: new Date('2026-10-01T02:40:00Z'),
    });
    const rq2 = FhirMapper.toMedicationRequest(
      simple,
      KFA,
      'MED-2',
      enc,
      ctx,
    ) as any;
    const di = rq2.dosageInstruction[0];
    expect(di.text).toBe('3 x sehari 1 kapsul sesudah makan');
    expect(di.additionalInstruction[0].text).toBe('S 3 dd caps I p.c.');
    expect(di.timing.repeat).toEqual({
      frequency: 3,
      period: 1,
      periodUnit: 'd',
      when: ['PC'],
    });
    expect(di.doseAndRate[0].doseQuantity).toMatchObject({
      value: 1,
      code: 'CAP',
    });
    expect(rq2.dispenseRequest.quantity).toMatchObject({
      value: 15,
      code: 'CAP',
    });
    expect(rq2.dispenseRequest.expectedSupplyDuration.value).toBe(5);

    // Bila perlu: tanpa lama pemakaian, asNeeded
    const prn = Object.assign(new PrescriptionItem(), {
      ...simple,
      signa: {
        ...simple.signa,
        prn: true,
        when: null,
        latin: 'S p.r.n. 3 dd caps I',
        text: 'bila perlu',
      },
    });
    const rq3 = FhirMapper.toMedicationRequest(
      prn,
      KFA,
      'MED-3',
      enc,
      ctx,
    ) as any;
    expect(rq3.dosageInstruction[0].asNeededBoolean).toBe(true);
    expect(rq3.dispenseRequest.expectedSupplyDuration).toBeUndefined();
  });
});

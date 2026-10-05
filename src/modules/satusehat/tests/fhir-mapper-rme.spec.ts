import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import { FhirContext, FhirMapper } from '../fhir/fhir-mapper';
import * as codes from '../fhir/clinical-codes';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { PhysicalExamination } from '../../physical-examination/entities/physical-examination.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { ToothCondition } from '../../odontogram/entities/tooth-condition.entity';

const ctx: FhirContext = {
  orgId: '100025702',
  patient: { id: 'P02478375538', name: 'Diana Smith' },
  practitioner: { id: '10009880728', name: 'dr. Budi' },
  location: { id: 'LOC-UUID', name: 'Poli Umum' },
  encounterId: 'ENC-UUID',
};
const when = new Date('2026-10-05T03:00:00.000Z');

/** Semua kode SNOMED CT di clinical-codes.ts dalam bentuk { code, display } */
function snomedCodings(): { path: string; code: string }[] {
  const out: { path: string; code: string }[] = [];
  const walk = (value: unknown, path: string) => {
    if (!value || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    if (typeof v.code === 'string' && typeof v.display === 'string') {
      if (/^\d{6,18}$/.test(v.code)) out.push({ path, code: v.code });
      return;
    }
    for (const [k, child] of Object.entries(v)) walk(child, `${path}.${k}`);
  };
  for (const [name, value] of Object.entries(codes)) {
    if (name === 'HEAD_TO_TOE') {
      for (const [part, spec] of Object.entries(codes.HEAD_TO_TOE)) {
        if (spec.site) walk(spec.site, `HEAD_TO_TOE.${part}.site`);
      }
      continue;
    }
    if (name === 'DMF_COUNT' || name === 'TOOTH_ANNOTATION') {
      // TOOTH_ANNOTATION mencampur kode clinical-term (OV0000xx)
      for (const [k, a] of Object.entries(value as Record<string, any>)) {
        if (a?.system === 'snomed' && a.coding) walk(a.coding, `${name}.${k}`);
        else if (name === 'DMF_COUNT') walk(a, `${name}.${k}`);
      }
      continue;
    }
    walk(value, name);
  }
  return out;
}

describe('clinical-codes', () => {
  it('every SNOMED CT code exists in the bundled terminology release', () => {
    const tsv = gunzipSync(
      readFileSync(
        join(__dirname, '../../../../data/terminology/snomed.tsv.gz'),
      ),
    ).toString('utf8');
    const known = new Set(tsv.split('\n').map((l) => l.split('\t')[0]));
    const all = snomedCodings();
    expect(all.length).toBeGreaterThan(80);
    expect(all.filter((c) => !known.has(c.code))).toEqual([]);
  });
});

describe('FhirMapper — RME Rawat Jalan poli umum', () => {
  const pe = {
    id: 7,
    updatedAt: when,
    head: 'Normocephal',
    eyes: 'Konjungtiva anemis -/-',
    lungAuscultation: 'Vesikuler +/+',
    heartAuscultation: 'S1 S2 reguler',
    rectal: '  ',
    generalCondition: 'Tampak sakit ringan',
    psychologicalStatus: 'anxious',
    psychologicalNote: 'Cemas menjelang tindakan',
    pregnancyStatus: 'not_pregnant',
  } as unknown as PhysicalExamination;

  it('head-to-toe: one exam Observation per filled body part, LOINC from the playbook (positive)', () => {
    const out = FhirMapper.toHeadToToe(pe, ctx);
    expect(out.map((r) => r.localType)).toEqual([
      'pe_exam_head',
      'pe_exam_eyes',
      'pe_exam_chest',
      'pe_exam_other',
    ]);
    const chest = out[2].resource as any;
    expect(chest.code.coding[0]).toEqual({
      system: 'http://loinc.org',
      code: '11391-0',
      display: 'Physical findings of Chest Narrative',
    });
    expect(chest.category[0].coding[0].code).toBe('exam');
    expect(chest.valueString).toBe(
      'Paru auskultasi: Vesikuler +/+; Jantung auskultasi: S1 S2 reguler',
    );
    expect(chest.effectiveDateTime).toBe('2026-10-05T03:00:00+00:00');
    expect(chest.encounter).toEqual({ reference: 'Encounter/ENC-UUID' });
  });

  it('head-to-toe: blank exam produces nothing (negative)', () => {
    expect(
      FhirMapper.toHeadToToe({ id: 1 } as PhysicalExamination, ctx),
    ).toEqual([]);
  });

  it('anus uses the Buttocks LOINC plus the Anal structure SNOMED code (edge)', () => {
    const [r] = FhirMapper.toHeadToToe(
      { id: 1, rectal: 'Tidak ada kelainan' } as PhysicalExamination,
      ctx,
    );
    expect((r.resource as any).code.coding.map((c: any) => c.code)).toEqual([
      '11388-6',
      '53505006',
    ]);
  });

  it('psychological & pregnancy status as coded survey Observations', () => {
    const [psych, preg] = FhirMapper.toFunctionalStatus(pe, ctx);
    expect((psych.resource as any).code.coding[0].code).toBe('8693-4');
    expect((psych.resource as any).valueCodeableConcept).toEqual({
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '48694002',
          display: 'Feeling anxious',
        },
      ],
      text: 'Cemas menjelang tindakan',
    });
    expect((preg.resource as any).code.coding[0].code).toBe('82810-3');
    expect((preg.resource as any).valueCodeableConcept.coding[0].code).toBe(
      '60001007',
    );
  });

  it('ClinicalImpression: history, clinical rationale and prognosis linked to diagnoses', () => {
    const out = FhirMapper.toClinicalImpressions(
      {
        id: 3,
        subjective: 'Demam 3 hari',
        assessment: 'Susp. ISPA',
        prognosis: 'good',
      },
      when,
      ctx,
      ['COND-1'],
    );
    expect(out.map((r) => r.localType)).toEqual([
      'soap_history',
      'soap_rationale',
      'soap_prognosis',
    ]);
    const [history, rationale, prognosis] = out.map((r) => r.resource as any);
    expect(history.code.coding[0].code).toBe('312850006');
    expect(history.summary).toBe('Demam 3 hari');
    expect(history.problem).toBeUndefined();
    expect(rationale.code.coding[0]).toEqual({
      system: 'http://terminology.kemkes.go.id',
      code: 'TK000056',
      display: 'Rasional Klinis',
    });
    expect(rationale.problem).toEqual([{ reference: 'Condition/COND-1' }]);
    expect(prognosis.prognosisCodeableConcept[0].coding[0].code).toBe(
      '170968001',
    );
    expect(prognosis.status).toBe('completed');
    expect(prognosis.assessor).toEqual({
      reference: 'Practitioner/10009880728',
      display: 'dr. Budi',
    });
  });

  it('ClinicalImpression: unknown prognosis value is not sent (negative)', () => {
    expect(
      FhirMapper.toClinicalImpressions(
        { id: 3, prognosis: 'excellent' },
        when,
        ctx,
        [],
      ),
    ).toEqual([]);
  });

  it('CarePlan: rencana rawat from plan, instruksi medik from treatment', () => {
    const out = FhirMapper.toCarePlans(
      { id: 3, plan: 'Kontrol 3 hari', treatment: 'Kompres hangat' },
      when,
      ctx,
    );
    expect(
      out.map((r) => [r.localType, (r.resource as any).description]),
    ).toEqual([
      ['soap_care_plan', 'Kontrol 3 hari'],
      ['soap_instruction', 'Kompres hangat'],
    ]);
    expect((out[0].resource as any).category[0].coding[0].code).toBe(
      '736271009',
    );
    expect((out[0].resource as any).intent).toBe('plan');
  });
});

describe('FhirMapper — anamnesis, odontogram, pulang', () => {
  it('history conditions & allergies from patient data', () => {
    const patient = {
      id: 9,
      riwayatHipertensi: true,
      riwayatDiabetes: false,
      punyaAlergi: true,
      alergiObat: true,
      catatanAlergi: 'Amoksisilin',
    } as unknown as Patient;
    const history = FhirMapper.toHistoryConditions(patient, ctx, when);
    expect(history.map((r) => (r.resource as any).code.coding[0].code)).toEqual(
      ['161501007'],
    );
    const allergies = FhirMapper.toAllergies(patient, ctx, when);
    expect(allergies).toHaveLength(1);
    expect((allergies[0].resource as any).code).toEqual({
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '416098002',
          display: 'Drug allergy',
        },
      ],
      text: 'Amoksisilin',
    });
  });

  it('odontogram: caries tooth counted as decayed, missing annotation counted', () => {
    const teeth = [
      { toothNumber: 16, surfaceOcclusal: 'karies' },
      { toothNumber: 36, teksAtas: 'MISSING' },
      { toothNumber: 11 },
    ] as unknown as ToothCondition[];
    const out = FhirMapper.toOdontogram(teeth, [], 5, when, ctx);
    expect(out.map((r) => r.localType)).toEqual([
      'odo_16',
      'odo_36',
      'dmf_decayed',
      'dmf_missing',
      'dmf_filled',
    ]);
    expect(out.slice(2).map((r) => (r.resource as any).valueInteger)).toEqual([
      1, 1, 0,
    ]);
    expect((out[0].resource as any).bodySite.coding[0].code).toBe('865995000');
  });

  it('discharge condition: unknown value yields null (negative)', () => {
    const enc = { id: 1, finishedTime: when } as Encounter;
    expect(FhirMapper.toDischargeCondition('nope', enc, ctx)).toBeNull();
    expect(
      (FhirMapper.toDischargeCondition('stable', enc, ctx) as any).code
        .coding[0].code,
    ).toBe('359746009');
  });
});

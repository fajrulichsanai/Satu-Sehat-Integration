import { PatientRelationsMapper } from '../fhir/patient-relations-mapper';
import { FhirContext, FhirMapper } from '../fhir/fhir-mapper';
import { Patient } from '../../patients/entities/patient.entity';

const ctx: FhirContext = {
  orgId: '100025702',
  patient: { id: 'P02478375538', name: 'Budi Kecil' },
  practitioner: { id: '10009880728', name: 'dr. A' },
  location: { id: 'LOC', name: 'Poli' },
  encounterId: 'ENC',
};
const when = new Date('2026-10-05T03:00:00.000Z');

describe('PatientRelationsMapper', () => {
  it('maps the guardian to RelatedPerson with NIK for the mother (positive)', () => {
    const r = PatientRelationsMapper.toRelatedPerson(
      {
        id: 7,
        namaWali: 'Siti Aminah',
        hubunganWali: 'ibu',
        nikIbu: '3171234567890001',
      } as unknown as Patient,
      ctx,
    )!;
    expect(r.localType).toBe('pt_related');
    expect(r.resource).toMatchObject({
      resourceType: 'RelatedPerson',
      identifier: [
        {
          use: 'official',
          system: 'https://fhir.kemkes.go.id/id/nik',
          value: '3171234567890001',
        },
      ],
      patient: { reference: 'Patient/P02478375538' },
      relationship: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              code: 'MTH',
              display: 'mother',
            },
          ],
        },
      ],
      name: [{ use: 'official', text: 'Siti Aminah' }],
      gender: 'female',
      communication: [
        { language: { coding: [{ code: 'id-ID' }] }, preferred: true },
      ],
    });
  });

  it('sends a guardian without NIK or gender, and nothing without a name (edge)', () => {
    const r = PatientRelationsMapper.toRelatedPerson(
      { id: 7, namaWali: 'Pak RT', hubunganWali: 'wali' } as unknown as Patient,
      ctx,
    )!;
    expect(r.resource.identifier).toBeUndefined();
    expect(r.resource.gender).toBeUndefined();
    expect(r.resource.relationship[0].coding[0].code).toBe('GUARD');
    expect(
      PatientRelationsMapper.toRelatedPerson(
        { id: 7, hubunganWali: 'ayah' } as unknown as Patient,
        ctx,
      ),
    ).toBeNull();
  });

  it('maps family history with a stable link per entry and voids removed ones (positive)', () => {
    const out = PatientRelationsMapper.toFamilyHistories(
      {
        id: 7,
        riwayatKeluarga: [
          {
            key: 'a1b2c3d4',
            relationship: 'FTH',
            code: 'E11',
            display: 'Non-insulin-dependent diabetes mellitus',
            nameId: 'Diabetes melitus tipe 2',
            note: 'Sejak usia 50',
          },
          {
            key: 'ffff0000',
            relationship: 'MTH',
            code: 'I10',
            display: 'Essential (primary) hypertension',
            nameId: null,
            note: null,
            removed: true,
          },
        ],
      } as unknown as Patient,
      ctx,
      when,
    );
    expect(out.map((r) => r.localType)).toEqual([
      'pt_fmh_a1b2c3d4',
      'pt_fmh_ffff0000',
    ]);
    expect(out[0].resource).toMatchObject({
      resourceType: 'FamilyMemberHistory',
      status: 'completed',
      patient: { reference: 'Patient/P02478375538' },
      date: '2026-10-05T03:00:00+00:00',
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
            code: 'FTH',
            display: 'father',
          },
        ],
      },
      condition: [
        {
          code: {
            coding: [
              {
                system: 'http://hl7.org/fhir/sid/icd-10',
                code: 'E11',
                display: 'Non-insulin-dependent diabetes mellitus',
              },
            ],
            text: 'Diabetes melitus tipe 2',
          },
          note: [{ text: 'Sejak usia 50' }],
        },
      ],
    });
    expect(out[1].resource.status).toBe('entered-in-error');
  });
});

describe('FhirMapper.toMedicationStatements', () => {
  const patient = {
    id: 7,
    riwayatObat: [
      {
        key: 'aaaa1111',
        kfaCode: '93001819',
        name: 'Amlodipine Besilate 5 mg Tablet (HOLI PHARMA)',
        dosage: '1 tablet sekali sehari',
        active: true,
      },
      {
        key: 'bbbb2222',
        kfaCode: null,
        name: 'Jamu',
        dosage: null,
        active: true,
      },
      {
        key: 'cccc3333',
        kfaCode: '93000001',
        name: 'Obat lama',
        dosage: null,
        active: false,
        removed: true,
      },
    ],
  } as unknown as Patient;

  it('maps KFA-coded drugs to MedicationStatement per the playbook (positive)', () => {
    const [r] = FhirMapper.toMedicationStatements(patient, ctx, when);
    expect(r.localType).toBe('pt_medst_aaaa1111');
    expect(r.localId).toBe(7);
    expect(r.resource).toEqual({
      resourceType: 'MedicationStatement',
      status: 'active',
      category: {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/medication-statement-category',
            code: 'outpatient',
            display: 'Outpatient',
          },
        ],
      },
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://sys-ids.kemkes.go.id/kfa',
            code: '93001819',
            display: 'Amlodipine Besilate 5 mg Tablet (HOLI PHARMA)',
          },
        ],
      },
      subject: expect.objectContaining({ reference: 'Patient/P02478375538' }),
      dosage: [{ text: '1 tablet sekali sehari' }],
      effectiveDateTime: expect.any(String),
      dateAsserted: expect.any(String),
      informationSource: expect.objectContaining({
        reference: 'Patient/P02478375538',
      }),
      context: { reference: 'Encounter/ENC' },
    });
  });

  it('skips drugs without a KFA code (negative)', () => {
    const out = FhirMapper.toMedicationStatements(patient, ctx, when);
    expect(out.map((r) => r.localType)).not.toContain('pt_medst_bbbb2222');
  });

  it('voids a removed, already-sent drug with entered-in-error (edge)', () => {
    const out = FhirMapper.toMedicationStatements(patient, ctx, when);
    const voided = out.find((r) => r.localType === 'pt_medst_cccc3333')!;
    expect(voided.resource.status).toBe('entered-in-error');
    expect(
      FhirMapper.toMedicationStatements(
        { id: 1, riwayatObat: null } as unknown as Patient,
        ctx,
        when,
      ),
    ).toEqual([]);
  });
});

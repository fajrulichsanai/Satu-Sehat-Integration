import { ImmunizationMapper } from '../fhir/immunization-mapper';
import { FhirContext } from '../fhir/fhir-mapper';
import { Immunization } from '../../immunizations/entities/immunization.entity';

const ctx: FhirContext = {
  orgId: '100025702',
  patient: { id: 'P02478375538', name: 'Budi Kecil' },
  practitioner: { id: '10009880728', name: 'dr. A' },
  location: { id: 'LOC-1', name: 'Poli Umum' },
  encounterId: 'ENC-1',
};

const row = (over: Partial<Immunization> = {}) =>
  ({
    id: 4,
    kfaCode: '93000123',
    vaccineName: 'Vaksin Hepatitis B 0,5 mL',
    doseNumber: 2,
    doseMl: '0.50',
    route: 'inj.intramuscular',
    site: 'LD',
    lotNumber: 'LOT-9',
    expirationDate: '2027-12-31',
    occurredAt: new Date('2026-10-05T03:00:00.000Z'),
    note: null,
    status: 'completed',
    ...over,
  }) as Immunization;

describe('ImmunizationMapper', () => {
  it('maps a vaccine to Immunization with the mandatory SATUSEHAT elements (positive)', () => {
    const { localType, localId, resource } = ImmunizationMapper.toImmunization(
      row(),
      ctx,
    );
    expect(localType).toBe('immunization');
    expect(localId).toBe(4);
    expect(resource).toMatchObject({
      resourceType: 'Immunization',
      status: 'completed',
      vaccineCode: {
        coding: [
          {
            system: 'http://sys-ids.kemkes.go.id/kfa',
            code: '93000123',
            display: 'Vaksin Hepatitis B 0,5 mL',
          },
        ],
      },
      patient: { reference: 'Patient/P02478375538' },
      encounter: { reference: 'Encounter/ENC-1' },
      occurrenceDateTime: '2026-10-05T03:00:00+00:00',
      primarySource: true,
      lotNumber: 'LOT-9',
      expirationDate: '2027-12-31',
      site: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
            code: 'LD',
            display: 'Left Deltoid',
          },
        ],
      },
      route: {
        coding: [
          {
            system: 'https://www.whocc.no/atc_ddd_index/',
            code: 'inj.intramuscular',
            display: 'Injection Intramuscular',
          },
        ],
      },
      doseQuantity: {
        value: 0.5,
        unit: 'mL',
        system: 'http://unitsofmeasure.org',
        code: 'mL',
      },
      performer: [{ actor: { reference: 'Practitioner/10009880728' } }],
      protocolApplied: [{ doseNumberPositiveInt: 2 }],
    });
  });

  it('omits optional parts that were not filled (edge)', () => {
    const { resource } = ImmunizationMapper.toImmunization(
      row({
        route: null,
        site: null,
        doseMl: null,
        lotNumber: null,
        expirationDate: null,
      }),
      ctx,
    );
    for (const k of [
      'route',
      'site',
      'doseQuantity',
      'lotNumber',
      'expirationDate',
    ])
      expect(resource[k]).toBeUndefined();
  });

  it('voids a removed entry and can fall back to the KFA template code (positive)', () => {
    const { resource } = ImmunizationMapper.toImmunization(
      row({ status: 'entered-in-error' }),
      ctx,
      { code: '92000123', display: 'Vaksin Hepatitis B' },
    );
    expect(resource.status).toBe('entered-in-error');
    expect(resource.vaccineCode.coding[0].code).toBe('92000123');
  });
});

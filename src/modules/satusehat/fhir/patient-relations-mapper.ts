/**
 * Data keluarga pasien → SATUSEHAT:
 *  - RelatedPerson        ← patients.nama_wali / hubungan_wali (+ NIK ibu)
 *  - FamilyMemberHistory  ← patients.riwayat_keluarga
 * Dibuat sekali per pasien, kunjungan berikutnya memperbarui (PUT).
 */
import { Patient } from '../../patients/entities/patient.entity';
import {
  FAMILY_RELATIONSHIPS,
  GUARDIAN_ROLE,
  ROLE_CODE_SYSTEM,
  familyHistoryLinkType,
} from '../../patients/family-history';
import {
  FhirContext,
  LinkedResource,
  SYS,
  fhirDateTime,
  patientRef,
} from './fhir-mapper';

const NIK_SYSTEM = 'https://fhir.kemkes.go.id/id/nik';

export class PatientRelationsMapper {
  /** Wali/penanggung jawab; null bila nama atau hubungan wali kosong. */
  static toRelatedPerson(
    patient: Patient,
    ctx: FhirContext,
  ): LinkedResource | null {
    const name = patient.namaWali?.trim();
    const role = patient.hubunganWali
      ? GUARDIAN_ROLE[patient.hubunganWali]
      : undefined;
    if (!name || !role) return null;
    const nik =
      patient.hubunganWali === 'ibu' && /^\d{16}$/.test(patient.nikIbu ?? '')
        ? patient.nikIbu
        : null;
    const gender =
      patient.hubunganWali === 'ibu'
        ? 'female'
        : patient.hubunganWali === 'ayah'
          ? 'male'
          : undefined;
    return {
      localType: 'pt_related',
      localId: patient.id,
      resource: {
        resourceType: 'RelatedPerson',
        ...(nik
          ? {
              identifier: [{ use: 'official', system: NIK_SYSTEM, value: nik }],
            }
          : {}),
        active: true,
        patient: patientRef(ctx),
        relationship: [{ coding: [{ system: ROLE_CODE_SYSTEM, ...role }] }],
        name: [{ use: 'official', text: name }],
        ...(gender ? { gender } : {}),
        communication: [
          {
            language: {
              coding: [
                {
                  system: 'urn:ietf:bcp:47',
                  code: 'id-ID',
                  display: 'Indonesian',
                },
              ],
            },
            preferred: true,
          },
        ],
      },
    };
  }

  static toFamilyHistories(
    patient: Patient,
    ctx: FhirContext,
    when: Date,
  ): LinkedResource[] {
    const date = fhirDateTime(when);
    return (patient.riwayatKeluarga ?? []).map((e) => {
      const rel = FAMILY_RELATIONSHIPS[e.relationship];
      return {
        localType: familyHistoryLinkType(e.key),
        localId: patient.id,
        resource: {
          resourceType: 'FamilyMemberHistory',
          status: e.removed ? 'entered-in-error' : 'completed',
          patient: patientRef(ctx),
          date,
          relationship: {
            coding: [
              {
                system: ROLE_CODE_SYSTEM,
                code: e.relationship,
                display: rel.display,
              },
            ],
            text: rel.label,
          },
          condition: [
            {
              code: {
                coding: [
                  { system: SYS.ICD10, code: e.code, display: e.display },
                ],
                ...(e.nameId ? { text: e.nameId } : {}),
              },
              ...(e.note ? { note: [{ text: e.note }] } : {}),
            },
          ],
        },
      };
    });
  }
}

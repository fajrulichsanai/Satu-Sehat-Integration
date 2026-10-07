/** Imunisasi per kunjungan → FHIR Immunization SATUSEHAT. */
import { Immunization } from '../../immunizations/entities/immunization.entity';
import {
  ACT_SITE_SYSTEM,
  IMMUNIZATION_ROUTES,
  IMMUNIZATION_SITES,
  ImmunizationRoute,
  ImmunizationSite,
} from '../../immunizations/immunization-codes';
import {
  FhirContext,
  LinkedResource,
  SYS,
  encounterRef,
  fhirDateTime,
  patientRef,
  practitionerRef,
} from './fhir-mapper';

export class ImmunizationMapper {
  static toImmunization(
    row: Immunization,
    ctx: FhirContext,
    vaccine: { code: string; display: string } = {
      code: row.kfaCode,
      display: row.vaccineName,
    },
  ): LinkedResource {
    const when = fhirDateTime(row.occurredAt);
    const route = row.route
      ? IMMUNIZATION_ROUTES[row.route as ImmunizationRoute]
      : undefined;
    const site = row.site
      ? IMMUNIZATION_SITES[row.site as ImmunizationSite]
      : undefined;
    return {
      localType: 'immunization',
      localId: row.id,
      resource: {
        resourceType: 'Immunization',
        status:
          row.status === 'entered-in-error' ? 'entered-in-error' : 'completed',
        vaccineCode: {
          coding: [
            { system: SYS.KFA, code: vaccine.code, display: vaccine.display },
          ],
          text: row.vaccineName,
        },
        patient: patientRef(ctx),
        encounter: encounterRef(ctx),
        occurrenceDateTime: when,
        recorded: when,
        primarySource: true,
        location: {
          reference: `Location/${ctx.location.id}`,
          display: ctx.location.name,
        },
        ...(row.lotNumber ? { lotNumber: row.lotNumber } : {}),
        ...(row.expirationDate ? { expirationDate: row.expirationDate } : {}),
        ...(site
          ? {
              site: {
                coding: [
                  {
                    system: ACT_SITE_SYSTEM,
                    code: row.site,
                    display: site.display,
                  },
                ],
              },
            }
          : {}),
        ...(route
          ? {
              route: {
                coding: [
                  {
                    system: route.system,
                    code: row.route,
                    display: route.display,
                  },
                ],
              },
            }
          : {}),
        ...(row.doseMl !== null && row.doseMl !== undefined
          ? {
              doseQuantity: {
                value: Number(row.doseMl),
                unit: 'mL',
                system: SYS.UCUM,
                code: 'mL',
              },
            }
          : {}),
        performer: [{ actor: practitionerRef(ctx) }],
        ...(row.note ? { note: [{ text: row.note }] } : {}),
        protocolApplied: [{ doseNumberPositiveInt: row.doseNumber }],
      },
    };
  }
}

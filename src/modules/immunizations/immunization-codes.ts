/**
 * Kode Immunization yang dipakai — hanya yang tercantum di spesifikasi
 * resmi SATUSEHAT (FHIR resource Immunization), supaya tidak ditolak.
 */
export const IMMUNIZATION_ROUTES = {
  'inj.intramuscular': {
    system: 'https://www.whocc.no/atc_ddd_index/',
    display: 'Injection Intramuscular',
    label: 'Suntik intramuskular (IM)',
  },
} as const;
export type ImmunizationRoute = keyof typeof IMMUNIZATION_ROUTES;
export const IMMUNIZATION_ROUTE_CODES = Object.keys(
  IMMUNIZATION_ROUTES,
) as ImmunizationRoute[];

/** Lokasi suntik (v3-ActSite) */
export const IMMUNIZATION_SITES = {
  LA: { display: 'Left Arm', label: 'Lengan kiri' },
  RA: { display: 'Right Arm', label: 'Lengan kanan' },
  LD: { display: 'Left Deltoid', label: 'Deltoid kiri' },
  RD: { display: 'Right Deltoid', label: 'Deltoid kanan' },
  LT: { display: 'Left Thigh', label: 'Paha kiri' },
  RT: { display: 'Right Thigh', label: 'Paha kanan' },
} as const;
export type ImmunizationSite = keyof typeof IMMUNIZATION_SITES;
export const IMMUNIZATION_SITE_CODES = Object.keys(
  IMMUNIZATION_SITES,
) as ImmunizationSite[];
export const ACT_SITE_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/v3-ActSite';

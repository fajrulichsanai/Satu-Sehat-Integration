/**
 * Alamat + kode wilayah administratif (Kemendagri) sesuai extension
 * SATUSEHAT `administrativeCode` (province, city, district, village, rt, rw).
 * Dipakai profil fasyankes, Organization, dan Location.
 */
export interface SatusehatAddress {
  line?: string | null;
  provinceCode?: string | null;
  provinceName?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  districtCode?: string | null;
  districtName?: string | null;
  villageCode?: string | null;
  villageName?: string | null;
  rt?: string | null;
  rw?: string | null;
  postalCode?: string | null;
}

/** Profil fasyankes (organisasi induk) untuk onboarding SATUSEHAT. */
export interface SatusehatFacilityProfile extends SatusehatAddress {
  /** klinik_pratama | klinik_utama | tpmd | tpmdg */
  facilityType?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export const FACILITY_TYPES = [
  'klinik_pratama',
  'klinik_utama',
  'tpmd',
  'tpmdg',
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

/** Organization.type (http://terminology.hl7.org/CodeSystem/organization-type) */
export const ORGANIZATION_TYPES: Record<string, string> = {
  prov: 'Healthcare Provider',
  dept: 'Hospital Department',
  team: 'Organizational team',
  other: 'Other',
};

/** Location.physicalType (location-physical-type) */
export const PHYSICAL_TYPES: Record<string, string> = {
  si: 'Site',
  bu: 'Building',
  wi: 'Wing',
  lvl: 'Level',
  wa: 'Ward',
  ro: 'Room',
  area: 'Area',
};

/** Organization.contact.purpose (contactentity-type) */
export const CONTACT_PURPOSES: Record<string, string> = {
  ADMIN: 'Administrative',
  BILL: 'Billing',
  HR: 'Human Resource',
  PAYOR: 'Payor',
  PATINF: 'Patient',
  PRESS: 'Press',
};

export const DAYS_OF_WEEK = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

/** Address FHIR dengan extension administrativeCode (hanya bagian yang terisi). */
export function toFhirAddress(
  a: SatusehatAddress | null | undefined,
  city?: string | null,
) {
  if (!a?.line && !a?.provinceCode) return undefined;
  const codes: [string, string | null | undefined][] = [
    ['province', a.provinceCode],
    ['city', a.cityCode],
    ['district', a.districtCode],
    ['village', a.villageCode],
    ['rt', a.rt],
    ['rw', a.rw],
  ];
  const ext = codes
    .filter(([, v]) => !!v?.trim())
    .map(([url, v]) => ({ url, valueCode: v!.trim() }));
  return {
    use: 'work',
    type: 'both',
    ...(a.line ? { line: [a.line] } : {}),
    ...(city || a.cityName ? { city: city || a.cityName } : {}),
    ...(a.postalCode ? { postalCode: a.postalCode } : {}),
    country: 'ID',
    ...(ext.length
      ? {
          extension: [
            {
              url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode',
              extension: ext,
            },
          ],
        }
      : {}),
  };
}

/** Field wajib alamat sebelum dikirim. */
export function missingAddressFields(
  a: SatusehatAddress | null | undefined,
): string[] {
  const out: string[] = [];
  if (!a?.line?.trim()) out.push('alamat');
  if (!a?.provinceCode) out.push('provinsi');
  if (!a?.cityCode) out.push('kabupaten/kota');
  if (!a?.districtCode) out.push('kecamatan');
  if (!a?.villageCode) out.push('kelurahan/desa');
  return out;
}

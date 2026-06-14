# Satu Sehat Integration Guide - Clinic Module

Dokumentasi lengkap untuk integrasi Satu Sehat FHIR resources dalam clinic setup flow.

## Architectural Overview

Ketika update data klinik dengan flag `createSatusehatResources=true`, sistem akan membuat 3 FHIR resources secara otomatis:

```
┌─────────────────────────────────────────┐
│  Update Clinic Endpoint                 │
│  PUT /settings/clinic                   │
│  + createSatusehatResources=true        │
└────────────────┬────────────────────────┘
                 │
                 ↓
    ┌────────────────────────────┐
    │  Clinic Service            │
    │  - Validate clinic data    │
    │  - Call FHIR Service       │
    │  - Save resource IDs       │
    └────────┬───────────────────┘
             │
             ├─────────────────────────────────────────────┐
             │                                             │
             ↓                                             ↓
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ 1. Create Divisi Organization │        │ 2. Create Layanan Organization│
│    (Department)               │        │    (Service - Child of Divisi)│
│ resourceType: Organization    │        │ resourceType: Organization    │
│ type: dept                    │        │ type: prov                    │
│ name: Divisi Pelayanan Medik &│        │ name: Layanan Gigi dan Mulut │
│       Penunjang               │        │ partOf: Divisi Organization  │
└──────────────────────────────┘        └──────────────────────────────┘
        │ ID returned                           │ ID returned
        └───────────────────────┬───────────────┘
                                │
                                ↓
                   ┌──────────────────────────────┐
                   │ 3. Create Poli Location      │
                   │ resourceType: Location       │
                   │ name: Poli Gigi dan Mulut   │
                   │ managingOrganization:        │
                   │   Layanan Organization      │
                   └──────────────────────────────┘
                           │ ID returned
                           ↓
            ┌──────────────────────────────┐
            │ Save all IDs to Clinic table │
            │ - satusehatDivisiOrgId       │
            │ - satusehatLayananOrgId      │
            │ - satusehatPoliLocationId    │
            └──────────────────────────────┘
```

## Database Schema

Kolom baru yang ditambahkan ke tabel `clinics`:

```sql
-- FHIR Resource IDs
satusehat_divisi_org_id VARCHAR(100) -- Organization ID for Divisi
satusehat_layanan_org_id VARCHAR(100) -- Organization ID for Layanan
satusehat_poli_location_id VARCHAR(100) -- Location ID for Poli

-- Kewilayahan Administrative Codes
satusehat_province_code VARCHAR(10) -- Kode Provinsi
satusehat_city_code VARCHAR(10) -- Kode Kota
satusehat_district_code VARCHAR(10) -- Kode District
satusehat_village_code VARCHAR(10) -- Kode Village/Sub-district

-- Additional Info
website VARCHAR(255) -- Clinic website URL
```

## API Usage

### Update Clinic with Satu Sehat Resource Creation

**Endpoint:**
```
PUT /settings/clinic
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Klinik Gigi Sehat Jaya",
  "address": "Jl. Kesehatan No. 123, Gedung Utama",
  "city": "Jakarta Selatan",
  "province": "DKI Jakarta",
  "postalCode": "12345",
  "phone": "021-12345678",
  "email": "info@klinik.com",
  "website": "www.klinik-gigi-sehat.com",
  "satusehatProvinceCode": "31",
  "satusehatCityCode": "3101",
  "satusehatDistrictCode": "310101",
  "satusehatVillageCode": "3101011",
  "operationalHours": {
    "senin": "08:00-17:00",
    "selasa": "08:00-17:00",
    "rabu": "08:00-17:00",
    "kamis": "08:00-17:00",
    "jumat": "08:00-16:00",
    "sabtu": "08:00-12:00",
    "minggu": "Tutup"
  },
  "createSatusehatResources": true
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Klinik Gigi Sehat Jaya",
    "address": "Jl. Kesehatan No. 123, Gedung Utama",
    "city": "Jakarta Selatan",
    "province": "DKI Jakarta",
    "phone": "021-12345678",
    "email": "info@klinik.com",
    "website": "www.klinik-gigi-sehat.com",
    "satusehatProvinceCode": "31",
    "satusehatCityCode": "3101",
    "satusehatDistrictCode": "310101",
    "satusehatVillageCode": "3101011",
    "satusehatDivisiOrgId": "68e9f74a-8a28-4819-9a21-794a2b9b6767",
    "satusehatLayananOrgId": "75a9f84b-9c35-4920-9b21-805c3b9c6768",
    "satusehatPoliLocationId": "13e1ed8e-3271-4396-b287-4abbacb5eb85",
    "setupComplete": true,
    "satusehatOrgId": "ORG123456",
    "satusehatEnvironment": "sandbox"
  },
  "satusehatResources": {
    "divisiOrgId": "68e9f74a-8a28-4819-9a21-794a2b9b6767",
    "layananOrgId": "75a9f84b-9c35-4920-9b21-805c3b9c6768",
    "poliLocationId": "13e1ed8e-3271-4396-b287-4abbacb5eb85"
  },
  "message": "Profil klinik berhasil diperbarui"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "SATUSEHAT_RESOURCE_CREATION_FAILED",
    "message": "Gagal membuat resource di Satu Sehat",
    "details": "Kode wilayah (provinsi, kota, district, village) diperlukan"
  }
}
```

## Prerequisites

Sebelum membuat Satu Sehat resources, pastikan:

1. **Klinik sudah dikonfigurasi dengan Satu Sehat:**
   ```json
   {
     "satusehatOrgId": "ORG123456",
     "satusehatClientId": "your-client-id",
     "satusehatClientSecret": "your-client-secret",
     "satusehatEnvironment": "sandbox"
   }
   ```
   Gunakan endpoint: `POST /settings/clinic/satusehat`

2. **Semua field kewilayahan sudah diisi:**
   - `satusehatProvinceCode` - Kode Provinsi (contoh: "31" untuk DKI Jakarta)
   - `satusehatCityCode` - Kode Kota (contoh: "3101" untuk Jakarta Selatan)
   - `satusehatDistrictCode` - Kode District (contoh: "310101" untuk Gambir)
   - `satusehatVillageCode` - Kode Village (contoh: "3101011" untuk Gambir)

   📍 **Untuk mendapatkan kode kewilayahan, gunakan Master Data APIs:**
   ```bash
   # Get Provinces
   GET /api/master-data/provinces
   
   # Get Cities by Province
   GET /api/master-data/cities?province_codes=31
   
   # Get Districts by City
   GET /api/master-data/districts?city_codes=3101
   
   # Get Sub-districts
   GET /api/master-data/sub-districts?district_codes=310101
   ```

3. **Klinik memiliki Satu Sehat OAuth credentials yang valid:**
   - Test koneksi menggunakan: `POST /settings/clinic/satusehat/test`

## FHIR Resources Created

### 1. Organization - Divisi Pelayanan Medik dan Penunjang

**Payload Structure:**
```json
{
  "resourceType": "Organization",
  "active": true,
  "identifier": [
    {
      "use": "official",
      "system": "http://sys-ids.kemkes.go.id/organization/{orgId}",
      "value": "DIVISI-{orgId}"
    }
  ],
  "type": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/organization-type",
          "code": "dept",
          "display": "Hospital Department"
        }
      ]
    }
  ],
  "name": "Divisi Pelayanan Medik dan Penunjang - {clinicName}",
  "telecom": [...],
  "address": [
    {
      "extension": [
        {
          "url": "https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode",
          "extension": [
            { "url": "province", "valueCode": "{provinceCode}" },
            { "url": "city", "valueCode": "{cityCode}" },
            { "url": "district", "valueCode": "{districtCode}" },
            { "url": "village", "valueCode": "{villageCode}" }
          ]
        }
      ]
    }
  ],
  "partOf": {
    "reference": "Organization/{satusehatOrgId}"
  }
}
```

**Response:**
- Returns `201 Created` dengan Location header
- Response body berisi resource lengkap dengan ID yang di-generate Satu Sehat

### 2. Organization - Layanan Gigi dan Mulut

Mirip dengan Divisi, tapi:
- `type.coding.code`: `"prov"` (Provider)
- `name`: `"Layanan Gigi dan Mulut - {clinicName}"`
- `partOf`: Reference ke Divisi Organization ID

### 3. Location - Poli Gigi dan Mulut

```json
{
  "resourceType": "Location",
  "identifier": [
    {
      "system": "http://sys-ids.kemkes.go.id/location/{orgId}",
      "value": "POLI-GIGI-{orgId}"
    }
  ],
  "status": "active",
  "name": "Poli Gigi dan Mulut - {clinicName}",
  "description": "Ruang Gigi dan Mulut...",
  "mode": "instance",
  "physicalType": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/location-physical-type",
        "code": "ro",
        "display": "Room"
      }
    ]
  },
  "position": {
    "longitude": -6.23,
    "latitude": 106.83,
    "altitude": 0
  },
  "managingOrganization": {
    "reference": "Organization/{layananOrgId}"
  },
  "extension": [
    {
      "url": "https://fhir.kemkes.go.id/r4/StructureDefinition/LocationServiceClass",
      "valueCodeableConcept": {
        "coding": [
          {
            "system": "http://terminology.kemkes.go.id/CodeSystem/locationServiceClass-Outpatient",
            "code": "reguler",
            "display": "Kelas Reguler"
          }
        ]
      }
    }
  ]
}
```

## Error Handling

### Validation Errors

1. **Missing Kewilayahan Codes:**
   ```json
   {
     "code": "BAD_REQUEST",
     "message": "Kode wilayah diperlukan untuk membuat resource Satu Sehat"
   }
   ```

2. **Missing Satu Sehat Configuration:**
   ```json
   {
     "code": "SATUSEHAT_CONFIG_INCOMPLETE",
     "message": "Konfigurasi SATUSEHAT belum lengkap"
   }
   ```

### Satu Sehat API Errors

Jika Satu Sehat API gagal:
- Error dikembalikan dengan detail dari Satu Sehat
- Resource yang sudah dibuat tidak akan didelete otomatis
- Manual cleanup diperlukan jika diperlukan

## Flow Diagram

```
┌─────────────────────────────────────────┐
│ 1. Client mengirim PUT request          │
│    dengan createSatusehatResources=true │
└────────────────┬────────────────────────┘
                 │
                 ↓
    ┌────────────────────────────┐
    │ 2. Clinic Service          │
    │    - Validate input        │
    │    - Update clinic fields  │
    └────────┬───────────────────┘
             │
             ↓
    ┌────────────────────────────────────┐
    │ 3. Check prerequisites             │
    │    - Satu Sehat config exists?     │
    │    - Kewilayahan codes filled?     │
    └────────┬───────────────────────────┘
             │
    ┌────────┴─────────┬──────────────────┐
    │ NO              │ YES              │
    ↓                 ↓
  ERROR            CONTINUE
                    │
                    ↓
        ┌─────────────────────────────┐
        │ 4. Create Divisi Org        │
        │    Call Satu Sehat API      │
        │    POST /Organization       │
        └─────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │ NO              │ YES
        ↓                 ↓
      ERROR            CONTINUE
                         │
                         ↓
            ┌──────────────────────────┐
            │ 5. Create Layanan Org    │
            │    (with parentOf Divisi)│
            │    POST /Organization    │
            └──────────┬───────────────┘
                       │
            ┌──────────┴────────┐
            │ NO              │ YES
            ↓                 ↓
          ERROR            CONTINUE
                              │
                              ↓
                ┌──────────────────────────┐
                │ 6. Create Poli Location  │
                │    (with managingOrg)    │
                │    POST /Location        │
                └──────────┬───────────────┘
                           │
                ┌──────────┴────────┐
                │ NO              │ YES
                ↓                 ↓
              ERROR            CONTINUE
                                  │
                                  ↓
                    ┌──────────────────────────┐
                    │ 7. Save all IDs to DB    │
                    │    UPDATE clinics        │
                    └──────────┬───────────────┘
                               │
                               ↓
                        ┌──────────────┐
                        │ Return 200 OK│
                        │ with IDs     │
                        └──────────────┘
```

## Code Structure

### SatusehatFhirService
Located: `src/modules/satusehat/satusehat-fhir.service.ts`

```typescript
class SatusehatFhirService {
  createDivisiOrganization(clinicId, data): Promise<string>
  createLayananOrganization(clinicId, data): Promise<string>
  createPoliLocation(clinicId, data): Promise<string>
}
```

### ClinicsService
Located: `src/modules/clinics/clinics.service.ts`

```typescript
async update(clinicId, dto, updatedBy)
  // Main update method
  // Calls createSatusehatResources if flag is true

private async createSatusehatResources(clinic, dto)
  // Orchestrates the 3 API calls in sequence
  // Saves returned IDs to clinic entity
```

## Testing Steps

### 1. Get Kewilayahan Codes
```bash
curl -X GET "http://localhost:3000/api/master-data/provinces"
curl -X GET "http://localhost:3000/api/master-data/cities?province_codes=31"
curl -X GET "http://localhost:3000/api/master-data/districts?city_codes=3101"
curl -X GET "http://localhost:3000/api/master-data/sub-districts?district_codes=310101"
```

### 2. Configure Satu Sehat
```bash
curl -X POST "http://localhost:3000/settings/clinic/satusehat" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "satusehatOrgId": "ORG123456",
    "satusehatClientId": "your-client-id",
    "satusehatClientSecret": "your-client-secret",
    "satusehatEnvironment": "sandbox"
  }'
```

### 3. Test Connection
```bash
curl -X POST "http://localhost:3000/settings/clinic/satusehat/test" \
  -H "Authorization: Bearer {token}"
```

### 4. Update Clinic with Resource Creation
```bash
curl -X PUT "http://localhost:3000/settings/clinic" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Klinik Gigi Sehat Jaya",
    "address": "Jl. Kesehatan No. 123",
    "city": "Jakarta Selatan",
    "province": "DKI Jakarta",
    "postalCode": "12345",
    "phone": "021-12345678",
    "email": "info@klinik.com",
    "website": "www.klinik-gigi-sehat.com",
    "satusehatProvinceCode": "31",
    "satusehatCityCode": "3101",
    "satusehatDistrictCode": "310101",
    "satusehatVillageCode": "3101011",
    "createSatusehatResources": true
  }'
```

## Troubleshooting

### "Kode wilayah diperlukan"
- Pastikan semua field kewilayahan sudah diisi dalam request
- Gunakan Master Data APIs untuk mendapatkan kode yang valid

### "Konfigurasi SATUSEHAT belum lengkap"
- Pastikan OAuth credentials sudah dikonfigurasi menggunakan endpoint satusehat config
- Test koneksi terlebih dahulu dengan endpoint test

### "Gagal membuat resource di Satu Sehat"
- Check Satu Sehat API connectivity
- Verify OAuth credentials masih valid
- Check response dari Satu Sehat API (in logs)
- Resources yang sudah dibuat tidak akan dihapus otomatis

## Future Enhancements

- [ ] Add automatic cleanup jika salah satu resource creation gagal
- [ ] Add async background job untuk resource creation (untuk handle long-running operations)
- [ ] Add webhook untuk track FHIR resource status
- [ ] Add ability untuk update FHIR resources jika clinic data berubah
- [ ] Add validation untuk memastikan resource IDs masih valid di Satu Sehat

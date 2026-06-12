# API SPECIFICATION
# ApexRecord - Sistem Manajemen Klinik Kesehatan

**Versi:** 1.0  
**Tanggal:** 11 Juni 2026  
**Tech Stack:** Next.js (API Routes) + MySQL  
**Base URL:** `/api/v1`  
**Auth:** Bearer Token (JWT via NextAuth)

---

## TABLE OF CONTENTS

1. [Conventions & Standards](#1-conventions--standards)
2. [Authentication](#2-authentication)
3. [User Management](#3-user-management)
4. [Patient Management](#4-patient-management)
5. [Queue Management](#5-queue-management)
6. [Encounter Management](#6-encounter-management)
7. [Clinical Documentation](#7-clinical-documentation)
8. [Billing & Payment](#8-billing--payment)
9. [Pharmacy Management](#9-pharmacy-management)
10. [Reporting](#10-reporting)
11. [Settings & Configuration](#11-settings--configuration)
12. [SATUSEHAT Integration (Proxy)](#12-satusehat-integration-proxy)
13. [Public Endpoints (No Auth)](#13-public-endpoints-no-auth)

---

## 1. CONVENTIONS & STANDARDS

### 1.1 Request / Response Format

Semua request dan response menggunakan `Content-Type: application/json`.

**Standard Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

**Standard Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "NIK harus 16 digit",
    "details": [
      { "field": "nik", "message": "NIK harus 16 digit" }
    ]
  }
}
```

### 1.2 HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK - Request berhasil |
| `201` | Created - Resource baru berhasil dibuat |
| `400` | Bad Request - Validasi gagal |
| `401` | Unauthorized - Token tidak valid atau expired |
| `403` | Forbidden - Tidak punya permission |
| `404` | Not Found - Resource tidak ditemukan |
| `409` | Conflict - Duplicate / konflik data |
| `422` | Unprocessable Entity - Business rule violation |
| `500` | Internal Server Error |

### 1.3 Authorization Header

```
Authorization: Bearer <jwt_token>
```

### 1.4 Common Query Parameters (List Endpoints)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Halaman |
| `limit` | integer | 20 | Item per halaman (max: 100) |
| `search` | string | - | Pencarian teks bebas |
| `sortBy` | string | `createdAt` | Field untuk sorting |
| `sortDir` | string | `desc` | `asc` atau `desc` |

### 1.5 Role Enum

`owner` | `admin` | `dokter` | `pending`

### 1.6 Clinic Context

Semua endpoint yang membutuhkan konteks klinik, `clinicId` diambil otomatis dari JWT token user (tidak perlu dikirim di body).

---

## 2. AUTHENTICATION

### `POST /api/v1/auth/register`

Registrasi user baru. Status awal: `pending` (kecuali ada Owner Code).

**Access:** Public

**Request Body:**
```json
{
  "name": "Dr. Budi Santoso",
  "email": "budi@klinik.com",
  "password": "P@ssw0rd123",
  "ownerCode": "ABC12345"
}
```

**Field Rules:**
- `name` required, string, max 100 char
- `email` required, valid email format, unique
- `password` required, min 8 char, harus ada uppercase + angka + special char
- `ownerCode` optional, jika valid → role `owner` + `isActive: true`

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "userId": "usr_abc123",
    "email": "budi@klinik.com",
    "role": "pending",
    "isActive": false,
    "message": "Verifikasi email telah dikirim"
  }
}
```

**Errors:**
- `409` - Email sudah terdaftar
- `400` - Validasi password/email gagal
- `422` - Owner Code tidak valid (user tetap dibuat sebagai pending)

---

### `POST /api/v1/auth/login`

Login dengan email dan password.

**Access:** Public

**Request Body:**
```json
{
  "email": "budi@klinik.com",
  "password": "P@ssw0rd123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 28800,
    "user": {
      "userId": "usr_abc123",
      "name": "Dr. Budi Santoso",
      "email": "budi@klinik.com",
      "role": "dokter",
      "isActive": true,
      "clinicId": "cln_xyz789",
      "clinicName": "Klinik Sehat Abadi",
      "practitionerId": "prc_def456"
    },
    "redirect": "/dashboard"
  }
}
```

**Redirect Logic:**
- `owner` + belum setup klinik → `/setup`
- `owner` + sudah setup → `/dashboard`
- `admin` / `dokter` + `isActive: true` → `/dashboard`
- `pending` / `isActive: false` → `/pending`

**Errors:**
- `401` - Email atau password salah
- `403` - Email belum diverifikasi
- `403` - Akun belum diaktivasi oleh Owner

---

### `POST /api/v1/auth/logout`

**Access:** Authenticated

**Response `200`:**
```json
{ "success": true }
```

---

### `POST /api/v1/auth/refresh`

Refresh JWT token.

**Access:** Authenticated

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 28800
  }
}
```

---

### `GET /api/v1/auth/me`

Ambil data user yang sedang login.

**Access:** Authenticated

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "userId": "usr_abc123",
    "name": "Dr. Budi Santoso",
    "email": "budi@klinik.com",
    "role": "dokter",
    "isActive": true,
    "clinicId": "cln_xyz789",
    "practitionerId": "prc_def456",
    "activationStatus": "active"
  }
}
```

---

### `GET /api/v1/auth/activation-status`

Polling endpoint untuk user pending cek status aktivasi.

**Access:** Authenticated (pending user)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "isActive": false,
    "role": "pending",
    "message": "Menunggu aktivasi oleh Owner"
  }
}
```

---

### `POST /api/v1/auth/verify-email`

Verifikasi email via token dari link email.

**Access:** Public

**Request Body:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response `200`:**
```json
{ "success": true, "message": "Email berhasil diverifikasi" }
```

---

## 3. USER MANAGEMENT

### `GET /api/v1/users`

Daftar semua user di klinik.

**Access:** `owner`

**Query Params:**
- `status`: `pending` | `active` | `inactive` | `all` (default: `all`)
- `role`: `admin` | `dokter` | `pending`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "userId": "usr_abc123",
      "name": "Siti Rahma",
      "email": "siti@klinik.com",
      "role": "admin",
      "isActive": true,
      "createdAt": "2026-06-01T08:00:00Z",
      "lastLoginAt": "2026-06-10T08:30:00Z"
    }
  ],
  "meta": { "total": 5, "pending": 2 }
}
```

---

### `POST /api/v1/users/:userId/activate`

Aktivasi user pending, assign role.

**Access:** `owner`

**Request Body:**
```json
{
  "role": "dokter",
  "practitionerId": "prc_def456"
}
```

- `role` required: `admin` | `dokter`
- `practitionerId` required jika `role = "dokter"`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "userId": "usr_abc123",
    "role": "dokter",
    "isActive": true,
    "activatedAt": "2026-06-11T09:00:00Z"
  }
}
```

**Errors:**
- `404` - User tidak ditemukan
- `409` - User sudah aktif
- `422` - `practitionerId` tidak valid untuk role dokter

---

### `POST /api/v1/users/:userId/deactivate`

Nonaktifkan user.

**Access:** `owner`

**Request Body:**
```json
{
  "reason": "Karyawan keluar"
}
```

**Response `200`:**
```json
{ "success": true, "message": "User berhasil dinonaktifkan" }
```

**Errors:**
- `403` - Tidak bisa deactivate diri sendiri
- `404` - User tidak ditemukan

---

### `DELETE /api/v1/users/:userId`

Tolak user pending (soft delete / hapus dari sistem).

**Access:** `owner`

**Request Body:**
```json
{
  "reason": "Bukan karyawan klinik ini"
}
```

**Response `200`:**
```json
{ "success": true }
```

---

## 4. PATIENT MANAGEMENT

### `GET /api/v1/patients`

Daftar pasien klinik.

**Access:** `owner`, `admin`, `dokter` (read-only)

**Query Params:**
- `search`: cari by nama, NIK, atau No. RM
- `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "patientId": "pat_xyz123",
      "noRM": "000042",
      "name": "Ahmad Fauzi",
      "nik": "3201****1234",
      "birthDate": "1990-05-12",
      "gender": "male",
      "phone": "08123456789",
      "syncStatus": "synced",
      "ihsNumber": "P02429547-8Z7V4L"
    }
  ],
  "meta": { "total": 150, "page": 1, "limit": 20 }
}
```

---

### `POST /api/v1/patients`

Daftarkan pasien baru.

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "nik": "3201234512345678",
  "name": "Ahmad Fauzi",
  "birthDate": "1990-05-12",
  "gender": "male",
  "phone": "08123456789",
  "email": "ahmad@email.com",
  "address": "Jl. Merdeka No. 10",
  "city": "Jakarta Selatan",
  "province": "DKI Jakarta",
  "postalCode": "12345",
  "maritalStatus": "married",
  "isNewborn": false
}
```

**Newborn tanpa NIK:**
```json
{
  "nikIbu": "3201234512345678",
  "name": "Bayi Ny. Siti",
  "birthDate": "2026-06-01",
  "gender": "male",
  "isNewborn": true,
  "birthOrder": 1
}
```

**Field Rules:**
- `nik` required (kecuali `isNewborn: true`)
- `nikIbu` required jika `isNewborn: true`
- `nik` atau `nikIbu`: exactly 16 digits, numeric
- `name` required, max 100 char
- `birthDate` required, format `YYYY-MM-DD`
- `gender` required: `male` | `female`

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "patientId": "pat_xyz123",
    "noRM": "000043",
    "name": "Ahmad Fauzi",
    "ihsNumber": "P02429547-8Z7V4L",
    "syncStatus": "synced"
  }
}
```

**Errors:**
- `400` - NIK format tidak valid (bukan 16 digit)
- `409` - Pasien dengan NIK ini sudah terdaftar di klinik (No. RM: XXXXXX)

---

### `GET /api/v1/patients/:patientId`

Detail pasien.

**Access:** `owner`, `admin`, `dokter`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "patientId": "pat_xyz123",
    "noRM": "000042",
    "nik": "3201234512345678",
    "name": "Ahmad Fauzi",
    "birthDate": "1990-05-12",
    "gender": "male",
    "phone": "08123456789",
    "email": "ahmad@email.com",
    "address": "Jl. Merdeka No. 10",
    "city": "Jakarta Selatan",
    "province": "DKI Jakarta",
    "postalCode": "12345",
    "maritalStatus": "married",
    "ihsNumber": "P02429547-8Z7V4L",
    "syncStatus": "synced",
    "createdAt": "2026-01-10T08:00:00Z",
    "updatedAt": "2026-06-01T10:00:00Z"
  }
}
```

---

### `PUT /api/v1/patients/:patientId`

Update data pasien.

**Access:** `owner`, `admin`

**Request Body** (partial update, hanya field yang boleh diubah):
```json
{
  "phone": "08129876543",
  "email": "newemail@email.com",
  "address": "Jl. Baru No. 5",
  "city": "Bandung",
  "postalCode": "40111",
  "maritalStatus": "single"
}
```

**Field yang TIDAK bisa diubah via endpoint ini:**
- `nik`, `noRM` (immutable setelah create)
- `birthDate` (butuh Owner approval, via endpoint terpisah)

**Response `200`:**
```json
{
  "success": true,
  "data": { "patientId": "pat_xyz123", "updatedAt": "2026-06-11T09:00:00Z" }
}
```

---

### `GET /api/v1/patients/:patientId/encounters`

Riwayat kunjungan pasien.

**Access:** `owner`, `admin`, `dokter`

**Query Params:**
- `limit` default 10
- `page`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "encounterId": "enc_abc001",
      "date": "2026-06-10",
      "practitionerName": "Dr. Budi Santoso",
      "chiefComplaint": "Sakit gigi",
      "status": "finished",
      "primaryDiagnosis": "K02.1 - Karies dentin"
    }
  ],
  "meta": { "total": 12 }
}
```

---

### `GET /api/v1/patients/search-satusehat`

Cari pasien di SATUSEHAT via NIK (proxy ke SATUSEHAT API).

**Access:** `owner`, `admin`

**Query Params:**
- `nik` required: 16 digits

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "found": true,
    "ihsNumber": "P02429547-8Z7V4L",
    "name": "Ahmad Fauzi",
    "birthDate": "1990-05-12",
    "gender": "male",
    "address": "Jl. Merdeka No. 10, Jakarta"
  }
}
```

---

## 5. QUEUE MANAGEMENT

### `GET /api/v1/queues`

Daftar antrian (Admin view).

**Access:** `owner`, `admin`, `dokter`

**Query Params:**
- `date`: format `YYYY-MM-DD`, default: today
- `practitionerId`: filter by dokter (dokter hanya bisa lihat miliknya)
- `status`: `waiting` | `confirmed` | `called` | `done` | `cancelled` | `all`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "queueId": "que_001",
      "nomorAntrian": 5,
      "patientName": "Ahmad Fauzi",
      "phone": "08123456789",
      "practitionerName": "Dr. Budi Santoso",
      "jamSlot": "09:00",
      "status": "waiting",
      "chiefComplaint": "Sakit gigi berlubang",
      "isOnlineBooking": true,
      "calledAt": null,
      "createdAt": "2026-06-11T07:30:00Z"
    }
  ],
  "meta": {
    "total": 20,
    "waiting": 8,
    "confirmed": 5,
    "called": 3,
    "done": 4,
    "cancelled": 0
  }
}
```

---

### `POST /api/v1/queues`

Buat antrian walk-in (Admin initiated).

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "patientId": "pat_xyz123",
  "practitionerId": "prc_def456",
  "tanggal": "2026-06-11",
  "jamSlot": "10:00",
  "chiefComplaint": "Sakit gigi"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "queueId": "que_002",
    "nomorAntrian": 6,
    "status": "confirmed"
  }
}
```

---

### `PATCH /api/v1/queues/:queueId/status`

Update status antrian.

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "status": "called",
  "reason": "Patient no-show"
}
```

**Allowed Transitions:**
- `waiting` → `confirmed`
- `waiting` → `cancelled` (reason required)
- `confirmed` → `called`
- `confirmed` → `cancelled` (reason required)
- `called` → `done`
- `called` → `cancelled` (reason required)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "queueId": "que_001",
    "status": "called",
    "calledAt": "2026-06-11T09:05:00Z"
  }
}
```

**Errors:**
- `422` - Transisi status tidak valid
- `422` - Reason diperlukan untuk cancel

---

### `GET /api/v1/queues/monitor`

Data untuk waiting room display (real-time).

**Access:** Public (no auth - untuk layar ruang tunggu)

**Query Params:**
- `clinicId` required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "calledNumbers": [
      {
        "nomorAntrian": 5,
        "patientName": "Ahmad F.",
        "practitionerName": "Dr. Budi",
        "calledAt": "2026-06-11T09:05:00Z"
      }
    ],
    "currentTime": "09:06:00"
  }
}
```

---

### `GET /api/v1/queues/slots`

Slot waktu tersedia untuk booking.

**Access:** Public

**Query Params:**
- `clinicId` required
- `date` required: `YYYY-MM-DD`
- `practitionerId` optional

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "practitionerId": "prc_def456",
      "practitionerName": "Dr. Budi Santoso",
      "slots": [
        { "time": "08:00", "available": true },
        { "time": "08:30", "available": false },
        { "time": "09:00", "available": true }
      ]
    }
  ]
}
```

---

## 6. ENCOUNTER MANAGEMENT

### `GET /api/v1/encounters`

Daftar encounter/kunjungan.

**Access:** `owner`, `admin` (all), `dokter` (own only)

**Query Params:**
- `date`: `YYYY-MM-DD`, default: today
- `practitionerId`: filter (auto-applied untuk dokter)
- `status`: `arrived` | `in_progress` | `finished` | `cancelled`
- `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "encounterId": "enc_abc001",
      "patientId": "pat_xyz123",
      "patientName": "Ahmad Fauzi",
      "noRM": "000042",
      "practitionerName": "Dr. Budi Santoso",
      "status": "in_progress",
      "serviceType": "outpatient",
      "chiefComplaint": "Sakit gigi",
      "arrivedTime": "2026-06-11T09:10:00Z",
      "inProgressTime": "2026-06-11T09:15:00Z",
      "finishedTime": null,
      "satusehatSyncStatus": "pending"
    }
  ],
  "meta": { "total": 15 }
}
```

---

### `POST /api/v1/encounters`

Buat encounter baru.

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "patientId": "pat_xyz123",
  "practitionerId": "prc_def456",
  "locationId": "loc_001",
  "queueId": "que_001",
  "serviceType": "outpatient",
  "chiefComplaint": "Sakit gigi berlubang"
}
```

- `queueId` optional, jika dari antrian
- `serviceType`: `outpatient` | `inpatient` | `emergency` (default: `outpatient`)

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "encounterId": "enc_abc002",
    "status": "arrived",
    "arrivedTime": "2026-06-11T09:10:00Z"
  }
}
```

---

### `GET /api/v1/encounters/:encounterId`

Detail encounter lengkap.

**Access:** `owner`, `admin` (all), `dokter` (own only)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "encounterId": "enc_abc001",
    "patientId": "pat_xyz123",
    "patientName": "Ahmad Fauzi",
    "noRM": "000042",
    "birthDate": "1990-05-12",
    "gender": "male",
    "practitionerId": "prc_def456",
    "practitionerName": "Dr. Budi Santoso",
    "locationId": "loc_001",
    "locationName": "Poli Gigi",
    "status": "in_progress",
    "serviceType": "outpatient",
    "chiefComplaint": "Sakit gigi berlubang",
    "arrivedTime": "2026-06-11T09:10:00Z",
    "inProgressTime": "2026-06-11T09:15:00Z",
    "finishedTime": null,
    "cancelledReason": null,
    "satusehatEncounterId": null,
    "satusehatSyncStatus": "pending",
    "createdBy": "usr_admin001",
    "createdAt": "2026-06-11T09:10:00Z"
  }
}
```

---

### `PATCH /api/v1/encounters/:encounterId/status`

Update status encounter.

**Access:** `owner`, `admin`, `dokter` (own only)

**Request Body:**
```json
{
  "status": "finished",
  "reason": "Patient refused treatment"
}
```

**Allowed Transitions:**
- `arrived` → `in_progress`
- `arrived` → `cancelled` (reason required)
- `in_progress` → `finished` (validates required clinical data)
- `in_progress` → `cancelled` (reason required)

**Validation untuk `finished`:**
- Harus ada minimal 1 keluhan utama (anamnesis)
- Harus ada minimal 1 vital sign
- Harus ada minimal 1 diagnosis (ICD-10)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "encounterId": "enc_abc001",
    "status": "finished",
    "finishedTime": "2026-06-11T10:30:00Z",
    "satusehatSyncTriggered": true
  }
}
```

**Errors:**
- `422` - `{"code": "INCOMPLETE_DOCUMENTATION", "missing": ["vitalSigns", "diagnosis"]}`

---

## 7. CLINICAL DOCUMENTATION

### 7.1 Anamnesis

### `GET /api/v1/encounters/:encounterId/anamnesis`

**Access:** `owner`, `dokter` (own)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "keluhanUtama": "Sakit gigi kanan bawah sudah 3 hari",
    "riwayatPenyakit": "Pernah sakit gigi sebelumnya 6 bulan lalu",
    "golonganDarah": "O",
    "rhesus": "+",
    "statusKehamilan": null,
    "alergi": [
      {
        "id": "alg_001",
        "substansi": "Amoxicillin",
        "reaksi": "Ruam kulit",
        "tingkat": "high"
      }
    ],
    "riwayatObat": [
      {
        "id": "med_001",
        "namaObat": "Paracetamol 500mg",
        "dosis": "500mg",
        "frekuensi": "3x sehari"
      }
    ]
  }
}
```

---

### `PUT /api/v1/encounters/:encounterId/anamnesis`

Simpan / update anamnesis (upsert).

**Access:** `owner`, `dokter` (own)

**Request Body:**
```json
{
  "keluhanUtama": "Sakit gigi kanan bawah sudah 3 hari",
  "riwayatPenyakit": "Pernah sakit gigi sebelumnya",
  "golonganDarah": "O",
  "rhesus": "+",
  "statusKehamilan": null,
  "alergi": [
    {
      "substansi": "Amoxicillin",
      "reaksi": "Ruam kulit",
      "tingkat": "high"
    }
  ],
  "riwayatObat": [
    {
      "namaObat": "Paracetamol 500mg",
      "dosis": "500mg",
      "frekuensi": "3x sehari"
    }
  ]
}
```

**Field Rules:**
- `keluhanUtama` required
- `golonganDarah`: `A` | `B` | `AB` | `O` | null
- `rhesus`: `+` | `-` | null
- `statusKehamilan`: `pregnant` | `not_pregnant` | null (hanya untuk pasien `gender: female`)
- `tingkat` alergi: `low` | `moderate` | `high`

**Response `200`:**
```json
{ "success": true, "data": { "savedAt": "2026-06-11T09:20:00Z" } }
```

---

### 7.2 Vital Signs

### `GET /api/v1/encounters/:encounterId/vital-signs`

**Access:** `owner`, `dokter` (own)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "vs_001",
      "loincCode": "8480-6",
      "name": "Tekanan Darah Sistolik",
      "value": 120,
      "unit": "mmHg",
      "isOutOfRange": false,
      "recordedAt": "2026-06-11T09:22:00Z"
    },
    {
      "id": "vs_002",
      "loincCode": "8462-4",
      "name": "Tekanan Darah Diastolik",
      "value": 80,
      "unit": "mmHg",
      "isOutOfRange": false,
      "recordedAt": "2026-06-11T09:22:00Z"
    }
  ]
}
```

---

### `PUT /api/v1/encounters/:encounterId/vital-signs`

Simpan vital signs (upsert semua sekaligus).

**Access:** `owner`, `dokter` (own)

**Request Body:**
```json
{
  "sistolic": 120,
  "diastolic": 80,
  "heartRate": 78,
  "respiratoryRate": 18,
  "temperature": 36.5
}
```

**Validation Ranges:**
| Field | Min | Max | Unit |
|-------|-----|-----|------|
| sistolic | 60 | 250 | mmHg |
| diastolic | 40 | 150 | mmHg |
| heartRate | 30 | 250 | /menit |
| respiratoryRate | 10 | 60 | /menit |
| temperature | 34.0 | 42.0 | °C |

Out-of-range → disimpan dengan `isOutOfRange: true` + warning di response.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "savedAt": "2026-06-11T09:22:00Z"
  },
  "warnings": [
    { "field": "sistolic", "message": "Nilai di atas normal (90-120 mmHg)" }
  ]
}
```

---

### 7.3 Diagnosis

### `GET /api/v1/encounters/:encounterId/diagnoses`

**Access:** `owner`, `dokter` (own), `admin` (read)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "diagnosisId": "dgn_001",
      "icd10Code": "K02.1",
      "icd10Display": "Dental caries limited to enamel",
      "clinicalStatus": "active",
      "category": "encounter-diagnosis",
      "bodySite": {
        "snomedCode": "76505004",
        "display": "Lower right first molar tooth"
      },
      "onsetDate": "2026-06-08",
      "note": "Lubang di permukaan mesial",
      "isPrimary": true,
      "satusehatConditionId": "cnd_xxx"
    }
  ]
}
```

---

### `POST /api/v1/encounters/:encounterId/diagnoses`

Tambah diagnosis.

**Access:** `owner`, `dokter` (own)

**Request Body:**
```json
{
  "icd10Code": "K02.1",
  "icd10Display": "Dental caries limited to enamel",
  "clinicalStatus": "active",
  "category": "encounter-diagnosis",
  "bodySiteCode": "76505004",
  "onsetDate": "2026-06-08",
  "note": "Lubang di permukaan mesial"
}
```

- `clinicalStatus`: `active` | `inactive` | `resolved` | `recurrence` | `relapse` | `remission`
- `category`: `encounter-diagnosis` | `problem-list-item`
- `bodySiteCode`: harus dari whitelist SNOMED codes (40+ kode anatomi)

**Response `201`:**
```json
{
  "success": true,
  "data": { "diagnosisId": "dgn_002", "isPrimary": false }
}
```

---

### `DELETE /api/v1/encounters/:encounterId/diagnoses/:diagnosisId`

Hapus diagnosis.

**Access:** `owner`, `dokter` (own), hanya selagi encounter belum `finished`

**Response `200`:**
```json
{ "success": true }
```

**Errors:**
- `403` - Encounter sudah finished, tidak bisa dihapus

---

### `GET /api/v1/icd10/search`

Cari kode ICD-10.

**Access:** Authenticated

**Query Params:**
- `q` required: keyword (kode atau nama penyakit)
- `limit` default: 25, max: 50

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "code": "K02.1", "display": "Dental caries limited to enamel" },
    { "code": "K02.2", "display": "Dental caries of dentine" }
  ]
}
```

---

### 7.4 Prosedur

### `GET /api/v1/encounters/:encounterId/procedures`

**Access:** `owner`, `dokter` (own), `admin` (read)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "procedureId": "prc_p001",
      "icd9Code": "96.54",
      "procedureName": "Dental scaling",
      "status": "completed",
      "performedStart": "2026-06-11T09:30:00Z",
      "performedEnd": "2026-06-11T09:50:00Z",
      "reasonDiagnosisId": "dgn_001",
      "toothNumber": "46",
      "note": null,
      "satusehatProcedureId": null
    }
  ]
}
```

---

### `POST /api/v1/encounters/:encounterId/procedures`

Tambah prosedur.

**Access:** `owner`, `dokter` (own)

**Request Body:**
```json
{
  "icd9Code": "96.54",
  "procedureName": "Dental scaling",
  "status": "completed",
  "performedStart": "2026-06-11T09:30:00Z",
  "performedEnd": "2026-06-11T09:50:00Z",
  "reasonDiagnosisId": "dgn_001",
  "toothNumber": "46",
  "note": null
}
```

- `status`: `preparation` | `in_progress` | `completed` | `not_done` | `stopped`
- `performedStart` required, tidak boleh di masa depan
- `toothNumber`: FDI notation (11-18, 21-28, 31-38, 41-48, 51-55, 61-65, 71-75, 81-85)

**Response `201`:**
```json
{
  "success": true,
  "data": { "procedureId": "prc_p002" }
}
```

---

### `DELETE /api/v1/encounters/:encounterId/procedures/:procedureId`

**Access:** `owner`, `dokter` (own), hanya selagi belum `finished`

---

### 7.5 Odontogram

### `GET /api/v1/encounters/:encounterId/odontogram`

**Access:** `owner`, `dokter` (own)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "teeth": {
      "16": {
        "surfaces": {
          "buccal": "karies",
          "palatal": null,
          "mesial": null,
          "distal": null,
          "occlusal": "komposit"
        },
        "statusAbove": "NON",
        "statusBelow": null,
        "isRCT": false
      }
    },
    "dmft": { "decayed": 2, "missing": 1, "filled": 3, "total": 6 },
    "additionalFindings": {
      "occlusion": "normal",
      "diastema": false,
      "anomaly": null
    }
  }
}
```

---

### `PUT /api/v1/encounters/:encounterId/odontogram`

Simpan odontogram (full replace).

**Access:** `owner`, `dokter` (own)

**Request Body:**
```json
{
  "teeth": {
    "16": {
      "surfaces": {
        "buccal": "karies",
        "palatal": null,
        "mesial": null,
        "distal": null,
        "occlusal": "komposit"
      },
      "statusAbove": "NON",
      "statusBelow": null,
      "isRCT": false
    }
  },
  "additionalFindings": {
    "occlusion": "normal",
    "diastema": false,
    "anomaly": null
  }
}
```

DMF-T dihitung otomatis oleh server.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "dmft": { "decayed": 2, "missing": 1, "filled": 3, "total": 6 },
    "savedAt": "2026-06-11T09:45:00Z"
  }
}
```

---

### 7.6 OHI-S (Oral Hygiene Index)

### `GET /api/v1/encounters/:encounterId/ohis`

**Access:** `owner`, `dokter` (own)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "scores": {
      "16": { "debris": 1, "calculus": 0 },
      "11": { "debris": 2, "calculus": 1 },
      "26": { "debris": 1, "calculus": 0 },
      "46": { "debris": 2, "calculus": 2 },
      "31": { "debris": 1, "calculus": 0 },
      "36": { "debris": 2, "calculus": 1 }
    },
    "summary": {
      "diS": 1.5,
      "ciS": 0.67,
      "ohiS": 2.17,
      "interpretation": "Sedang (Fair)"
    }
  }
}
```

---

### `PUT /api/v1/encounters/:encounterId/ohis`

Simpan skor OHI-S.

**Access:** `owner`, `dokter` (own)

**Request Body:**
```json
{
  "scores": {
    "16": { "debris": 1, "calculus": 0 },
    "11": { "debris": 2, "calculus": 1 },
    "26": { "debris": 1, "calculus": 0 },
    "46": { "debris": 2, "calculus": 2 },
    "31": { "debris": 1, "calculus": 0 },
    "36": { "debris": 2, "calculus": 1 }
  }
}
```

Nilai debris dan calculus: `0` | `1` | `2` | `3`

Summary dihitung otomatis oleh server.

---

### 7.7 Resep (Prescription)

### `GET /api/v1/encounters/:encounterId/prescriptions`

**Access:** `owner`, `admin`, `dokter` (own)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "prescriptionId": "rx_001",
      "medicationId": "med_023",
      "medicationName": "Amoxicillin 500mg",
      "dosageForm": "kapsul",
      "strength": "500mg",
      "dosageInstruction": "3x1 kapsul sesudah makan",
      "quantity": 15,
      "duration": 5,
      "durationUnit": "days",
      "note": "Habiskan antibiotik",
      "status": "active",
      "dispensedAt": null,
      "satusehatMedReqId": null
    }
  ]
}
```

---

### `POST /api/v1/encounters/:encounterId/prescriptions`

Tulis resep.

**Access:** `owner`, `dokter` (own)

**Request Body:**
```json
{
  "medicationId": "med_023",
  "dosageInstruction": "3x1 kapsul sesudah makan",
  "quantity": 15,
  "duration": 5,
  "durationUnit": "days",
  "note": "Habiskan antibiotik"
}
```

- `durationUnit`: `days` | `weeks` | `months`

**Response `201`:**
```json
{
  "success": true,
  "data": { "prescriptionId": "rx_002" }
}
```

**Errors:**
- `409` - Obat sudah ada di resep (duplicate warning)

---

### `DELETE /api/v1/encounters/:encounterId/prescriptions/:prescriptionId`

Batalkan resep. Hanya bisa jika belum di-dispense.

**Access:** `owner`, `dokter` (own)

**Response `200`:**
```json
{ "success": true }
```

**Errors:**
- `422` - Resep sudah di-dispense, tidak bisa dibatalkan

---

## 8. BILLING & PAYMENT

### `GET /api/v1/billings`

Daftar tagihan.

**Access:** `owner`, `admin`

**Query Params:**
- `status`: `unpaid` | `partial` | `paid` | `cancelled` | `refunded` | `all`
- `dateFrom`, `dateTo`: `YYYY-MM-DD`
- `patientId`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "billingId": "bil_001",
      "encounterId": "enc_abc001",
      "patientName": "Ahmad Fauzi",
      "grandTotal": 250000,
      "paidAmount": 250000,
      "outstandingAmount": 0,
      "status": "paid",
      "createdAt": "2026-06-11T10:35:00Z"
    }
  ]
}
```

---

### `POST /api/v1/billings`

Buat tagihan baru.

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "encounterId": "enc_abc001",
  "items": [
    {
      "tarifId": "trf_001",
      "name": "Konsultasi Umum",
      "quantity": 1,
      "unitPrice": 100000,
      "discount": 0,
      "discountType": "nominal"
    },
    {
      "tarifId": "trf_045",
      "name": "Scaling Gigi",
      "quantity": 1,
      "unitPrice": 200000,
      "discount": 10,
      "discountType": "percent"
    }
  ],
  "totalDiscount": 0,
  "totalDiscountType": "nominal",
  "notes": ""
}
```

- `discountType`: `percent` | `nominal`
- Discount tidak boleh melebihi `diskonMaksimal` dari tarif

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "billingId": "bil_002",
    "subtotal": 300000,
    "totalDiscount": 20000,
    "grandTotal": 280000,
    "status": "unpaid",
    "invoiceNumber": "INV-2026-00042"
  }
}
```

**Errors:**
- `422` - Discount melebihi batas maksimal tarif
- `409` - Encounter sudah memiliki billing aktif

---

### `GET /api/v1/billings/:billingId`

Detail tagihan.

**Access:** `owner`, `admin`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "billingId": "bil_001",
    "invoiceNumber": "INV-2026-00042",
    "encounterId": "enc_abc001",
    "patientId": "pat_xyz123",
    "patientName": "Ahmad Fauzi",
    "noRM": "000042",
    "items": [
      {
        "tarifId": "trf_001",
        "name": "Konsultasi Umum",
        "quantity": 1,
        "unitPrice": 100000,
        "discount": 0,
        "subtotal": 100000
      }
    ],
    "subtotal": 300000,
    "totalDiscount": 20000,
    "grandTotal": 280000,
    "paidAmount": 280000,
    "outstandingAmount": 0,
    "status": "paid",
    "payments": [
      {
        "paymentId": "pay_001",
        "method": "cash",
        "amount": 280000,
        "note": null,
        "paidAt": "2026-06-11T10:40:00Z",
        "processedBy": "Siti Rahma"
      }
    ],
    "createdAt": "2026-06-11T10:35:00Z",
    "createdBy": "Siti Rahma"
  }
}
```

---

### `POST /api/v1/billings/:billingId/payments`

Proses pembayaran.

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "method": "cash",
  "amount": 280000,
  "note": null
}
```

- `method`: `cash` | `transfer` | `insurance` | `bpjs`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_001",
    "paidAmount": 280000,
    "outstandingAmount": 0,
    "billingStatus": "paid",
    "receiptNumber": "RCP-2026-00042"
  }
}
```

---

### `GET /api/v1/billings/:billingId/invoice`

Download invoice PDF.

**Access:** `owner`, `admin`

**Response:** `application/pdf` (file download)

---

### `POST /api/v1/billings/:billingId/refund-request`

Buat permintaan refund (perlu approval Owner).

**Access:** `admin`

**Request Body:**
```json
{
  "amount": 280000,
  "reason": "Layanan tidak diberikan"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "refundRequestId": "rfnd_001",
    "status": "pending_approval",
    "message": "Permintaan refund menunggu persetujuan Owner"
  }
}
```

---

### `POST /api/v1/billings/:billingId/refund-request/:requestId/approve`

Approve atau reject refund request.

**Access:** `owner`

**Request Body:**
```json
{
  "action": "approve",
  "note": "Disetujui karena layanan batal"
}
```

- `action`: `approve` | `reject`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "refundRequestId": "rfnd_001",
    "status": "approved",
    "processedAt": "2026-06-11T11:00:00Z"
  }
}
```

---

## 9. PHARMACY MANAGEMENT

### `GET /api/v1/medications`

Daftar obat.

**Access:** `owner`, `admin`, `dokter`

**Query Params:**
- `search`: nama obat
- `lowStock`: `true` → hanya yang stok ≤ minStock
- `nearExpiry`: `true` → yang kadaluarsa ≤ 30 hari

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "medicationId": "med_023",
      "name": "Amoxicillin 500mg",
      "genericName": "Amoxicillin",
      "strength": "500mg",
      "dosageForm": "kapsul",
      "quantity": 120,
      "minStock": 30,
      "price": 3000,
      "expirationDate": "2027-01-01",
      "isLowStock": false,
      "isNearExpiry": false
    }
  ]
}
```

---

### `POST /api/v1/medications`

Tambah obat baru.

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "name": "Amoxicillin 500mg",
  "genericName": "Amoxicillin",
  "strength": "500mg",
  "strengthUnit": "mg",
  "dosageForm": "kapsul",
  "quantity": 200,
  "minStock": 30,
  "price": 3000,
  "supplier": "PT Kimia Farma",
  "expirationDate": "2027-01-01"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": { "medicationId": "med_024" }
}
```

---

### `PATCH /api/v1/medications/:medicationId/stock`

Adjust stok obat secara manual.

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "type": "in",
  "quantity": 100,
  "reason": "Pembelian dari supplier",
  "batchNo": "BATCH-2026-001",
  "expirationDate": "2027-06-01"
}
```

- `type`: `in` | `out` | `adjustment`
- `reason` required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "medicationId": "med_023",
    "previousQuantity": 120,
    "adjustedQuantity": 100,
    "newQuantity": 220
  }
}
```

---

### `POST /api/v1/encounters/:encounterId/dispense`

Keluarkan obat dari resep encounter ini.

**Access:** `owner`, `admin`

**Request Body:**
```json
{
  "items": [
    {
      "prescriptionId": "rx_001",
      "medicationId": "med_023",
      "quantityDispensed": 15
    }
  ]
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "dispenseId": "dsp_001",
    "dispensedAt": "2026-06-11T11:05:00Z",
    "items": [
      {
        "prescriptionId": "rx_001",
        "medicationName": "Amoxicillin 500mg",
        "quantityDispensed": 15,
        "stockRemaining": 105,
        "labelPrintUrl": "/api/v1/dispense/dsp_001/label"
      }
    ]
  }
}
```

**Errors:**
- `422` - Stok tidak mencukupi untuk item tertentu
- `409` - Resep sudah pernah di-dispense

---

## 10. REPORTING

### `GET /api/v1/reports/visits`

Laporan kunjungan.

**Access:** `owner`, `admin` (all), `dokter` (own only)

**Query Params:**
- `dateFrom` required: `YYYY-MM-DD`
- `dateTo` required: `YYYY-MM-DD`
- `practitionerId`: filter (auto-applied untuk dokter)
- `status`: filter status encounter

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 120,
      "finished": 110,
      "cancelled": 5,
      "inProgress": 5,
      "avgDurationMinutes": 22
    },
    "byDay": [
      { "date": "2026-06-10", "count": 25 },
      { "date": "2026-06-11", "count": 18 }
    ],
    "byDoctor": [
      { "practitionerName": "Dr. Budi", "count": 65 }
    ],
    "encounters": [
      {
        "encounterId": "enc_abc001",
        "date": "2026-06-10",
        "patientName": "Ahmad Fauzi",
        "practitionerName": "Dr. Budi",
        "status": "finished",
        "durationMinutes": 20
      }
    ]
  },
  "meta": { "total": 120, "page": 1 }
}
```

---

### `GET /api/v1/reports/financial`

Laporan keuangan.

**Access:** `owner` only

**Query Params:**
- `dateFrom` required
- `dateTo` required
- `type`: `summary` | `detailed` (default: `summary`)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalBilling": 45000000,
      "totalPaid": 42000000,
      "totalOutstanding": 3000000,
      "collectionRate": 93.3,
      "totalRefunded": 500000
    },
    "byDay": [
      { "date": "2026-06-10", "revenue": 8500000, "collected": 8000000 }
    ],
    "byPaymentMethod": [
      { "method": "cash", "amount": 30000000 },
      { "method": "transfer", "amount": 12000000 }
    ],
    "byDoctor": [
      { "practitionerName": "Dr. Budi", "revenue": 25000000 }
    ]
  }
}
```

---

### `GET /api/v1/reports/satusehat-sync`

Status sinkronisasi SATUSEHAT.

**Access:** `owner` only

**Query Params:**
- `dateFrom`, `dateTo`
- `resourceType`: `Patient` | `Encounter` | `Condition` | `Procedure` | `Observation` | `MedicationRequest` | `all`
- `syncStatus`: `synced` | `failed` | `pending` | `all`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 1500,
      "synced": 1450,
      "failed": 30,
      "pending": 20,
      "syncRate": 96.7
    },
    "byResource": [
      { "resourceType": "Patient", "synced": 200, "failed": 2, "pending": 0 }
    ],
    "failedItems": [
      {
        "resourceType": "Encounter",
        "localId": "enc_abc001",
        "errorCode": "400",
        "errorMessage": "Invalid FHIR format",
        "failedAt": "2026-06-10T15:00:00Z",
        "retryCount": 2
      }
    ]
  }
}
```

---

### `POST /api/v1/reports/satusehat-sync/retry`

Retry sync yang gagal.

**Access:** `owner`

**Request Body:**
```json
{
  "resourceType": "Encounter",
  "localIds": ["enc_abc001", "enc_abc002"]
}
```

Jika `localIds` kosong / tidak disertakan → retry all failed.

**Response `200`:**
```json
{
  "success": true,
  "data": { "queued": 2, "message": "Proses retry dimulai di background" }
}
```

---

## 11. SETTINGS & CONFIGURATION

### `GET /api/v1/settings/clinic`

Ambil info klinik.

**Access:** `owner`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "clinicId": "cln_xyz789",
    "name": "Klinik Sehat Abadi",
    "address": "Jl. Pahlawan No. 10",
    "city": "Padang",
    "province": "Sumatera Barat",
    "phone": "0751-123456",
    "email": "info@kliniksehat.com",
    "sip": "SIP-12345",
    "operationalHours": {
      "Senin": { "open": "08:00", "close": "17:00", "isOpen": true },
      "Selasa": { "open": "08:00", "close": "17:00", "isOpen": true },
      "Minggu": { "open": null, "close": null, "isOpen": false }
    },
    "satusehatConfig": {
      "environment": "production",
      "isConnected": true,
      "organizationId": "org_satusehat_xxx",
      "lastTokenAt": "2026-06-11T08:00:00Z"
    },
    "setupComplete": true
  }
}
```

---

### `PUT /api/v1/settings/clinic`

Update info klinik.

**Access:** `owner`

**Request Body:**
```json
{
  "name": "Klinik Sehat Abadi",
  "address": "Jl. Pahlawan No. 10",
  "city": "Padang",
  "phone": "0751-123456",
  "email": "info@kliniksehat.com",
  "operationalHours": {
    "Senin": { "open": "08:00", "close": "17:00", "isOpen": true }
  }
}
```

---

### `POST /api/v1/settings/satusehat`

Konfigurasi / update SATUSEHAT credentials.

**Access:** `owner`

**Request Body:**
```json
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "environment": "production"
}
```

- `environment`: `sandbox` | `production`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "environment": "production",
    "message": "Koneksi SATUSEHAT berhasil"
  }
}
```

---

### `POST /api/v1/settings/satusehat/test`

Test koneksi SATUSEHAT.

**Access:** `owner`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "tokenObtained": true,
    "responseTime": 320,
    "message": "Koneksi OK"
  }
}
```

---

### `GET /api/v1/settings/practitioners`

Daftar practitioner terdaftar.

**Access:** `owner`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "practitionerId": "prc_def456",
      "name": "Dr. Budi Santoso",
      "nik": "3201****1234",
      "specialization": "Dokter Gigi",
      "satusehatPractitionerId": "N10000002",
      "isActive": true
    }
  ]
}
```

---

### `POST /api/v1/settings/practitioners/search-satusehat`

Cari practitioner di SATUSEHAT sebelum daftarkan.

**Access:** `owner`

**Request Body:**
```json
{
  "searchBy": "nik",
  "nik": "3201234512345678"
}
```

atau:

```json
{
  "searchBy": "name",
  "name": "Budi Santoso",
  "birthDate": "1985-03-20",
  "gender": "male"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "found": true,
    "satusehatPractitionerId": "N10000002",
    "name": "Budi Santoso",
    "nik": "3201234512345678",
    "birthDate": "1985-03-20",
    "gender": "male"
  }
}
```

---

### `POST /api/v1/settings/practitioners`

Daftarkan practitioner ke sistem.

**Access:** `owner`

**Request Body:**
```json
{
  "satusehatPractitionerId": "N10000002",
  "nik": "3201234512345678",
  "name": "Dr. Budi Santoso",
  "birthDate": "1985-03-20",
  "gender": "male",
  "specialization": "Dokter Gigi"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": { "practitionerId": "prc_def456" }
}
```

---

### `GET /api/v1/settings/tarifs`

Daftar tarif layanan.

**Access:** `owner`, `admin`

**Query Params:**
- `kategori`: filter by kategori

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "tarifId": "trf_001",
      "name": "Konsultasi Dokter Umum",
      "kategori": "Konsultasi",
      "kodeICD9": null,
      "hargaJual": 100000,
      "diskonMaksimal": 20000,
      "isActive": true
    }
  ]
}
```

---

### `POST /api/v1/settings/tarifs`

Tambah tarif.

**Access:** `owner`

**Request Body:**
```json
{
  "name": "Scaling Gigi",
  "kategori": "Tindakan",
  "kodeICD9": "96.54",
  "hargaPokok": 100000,
  "hargaJual": 200000,
  "diskonMaksimal": 40000
}
```

---

### `GET /api/v1/settings/soap-templates`

Daftar template SOAP.

**Access:** `owner`, `dokter`

**Query Params:**
- `type`: `personal` | `shared` | `all`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "templateId": "tpl_001",
      "name": "Karies Gigi Ringan",
      "sections": {
        "subjective": "Keluhan sakit gigi...",
        "objective": "Tampak kavitas...",
        "assessment": "K02.1 - Dental caries",
        "plan": "Tumpatan komposit..."
      },
      "isShared": true,
      "createdBy": "usr_owner001"
    }
  ]
}
```

---

### `POST /api/v1/settings/soap-templates`

Buat template SOAP baru.

**Access:** `owner` (bisa shared), `dokter` (personal only)

**Request Body:**
```json
{
  "name": "Karies Gigi Ringan",
  "sections": {
    "subjective": "Keluhan sakit gigi...",
    "objective": "Tampak kavitas...",
    "assessment": "K02.1 - Dental caries",
    "plan": "Tumpatan komposit..."
  },
  "isShared": true
}
```

---

### `GET /api/v1/settings/locations`

Daftar lokasi layanan.

**Access:** `owner`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "locationId": "loc_001",
      "name": "Poli Gigi",
      "type": "HOSP",
      "satusehatLocationId": "loc_ss_xxx",
      "isActive": true
    }
  ]
}
```

---

## 12. SATUSEHAT INTEGRATION (PROXY)

Endpoint berikut adalah proxy ke SATUSEHAT API. Token management ditangani server-side.

### `POST /api/v1/satusehat/sync/:resourceType/:localId`

Trigger manual sync satu resource ke SATUSEHAT.

**Access:** `owner`

**Params:**
- `resourceType`: `Patient` | `Encounter` | `Condition` | `Procedure` | `Observation` | `MedicationRequest`
- `localId`: ID lokal resource

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "localId": "enc_abc001",
    "satusehatId": "enc_ss_xyz",
    "syncStatus": "synced",
    "syncedAt": "2026-06-11T11:10:00Z"
  }
}
```

---

## 13. PUBLIC ENDPOINTS (NO AUTH)

### `GET /api/v1/public/clinic-info`

Info klinik untuk halaman booking publik.

**Query Params:**
- `clinicId` required

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "name": "Klinik Sehat Abadi",
    "address": "Jl. Pahlawan No. 10, Padang",
    "phone": "0751-123456",
    "operationalHours": {
      "Senin": { "open": "08:00", "close": "17:00" }
    }
  }
}
```

---

### `GET /api/v1/public/available-slots`

Slot booking tersedia.

**Query Params:**
- `clinicId` required
- `date` required: `YYYY-MM-DD`

**Response `200`:** (sama dengan `GET /api/v1/queues/slots`)

---

### `POST /api/v1/public/book`

Daftar antrian online (tanpa login).

**Request Body:**
```json
{
  "clinicId": "cln_xyz789",
  "practitionerId": "prc_def456",
  "tanggal": "2026-06-12",
  "jamSlot": "09:00",
  "patientName": "Andi Pratama",
  "phone": "08123456789",
  "chiefComplaint": "Sakit gigi",
  "isFirstVisit": true
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "nomorAntrian": 7,
    "token": "A3B7K9M2",
    "tanggal": "2026-06-12",
    "jamSlot": "09:00",
    "doctorName": "Dr. Budi Santoso",
    "clinicAddress": "Jl. Pahlawan No. 10, Padang",
    "message": "Harap datang 15 menit lebih awal"
  }
}
```

**Errors:**
- `409` - Slot sudah penuh, pilih waktu lain

---

### `GET /api/v1/public/queue-status`

Cek status antrian via token.

**Query Params:**
- `token` required: 8-character token

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "nomorAntrian": 7,
    "status": "waiting",
    "currentPosition": 3,
    "estimatedWaitMinutes": 45,
    "currentCalledNumber": 4,
    "doctorName": "Dr. Budi Santoso",
    "tanggal": "2026-06-12",
    "jamSlot": "09:00"
  }
}
```

---

### `DELETE /api/v1/public/book/:token`

Batalkan booking via token (patient self-cancel).

**Response `200`:**
```json
{
  "success": true,
  "message": "Booking berhasil dibatalkan"
}
```

**Errors:**
- `404` - Token tidak ditemukan
- `422` - Status sudah `called` atau `done`, tidak bisa dibatalkan

---

## APPENDIX

### A. MySQL Database Tables (Reference)

```
users               - user account, role, isActive
clinics             - clinic info, satusehat config
practitioners       - dokter registered to SATUSEHAT
locations           - ruang pemeriksaan / poli
patients            - data pasien, noRM, ihsNumber
queues              - antrian, token, status
encounters          - kunjungan, status lifecycle
anamnesis           - keluhan, riwayat, alergi, obat_saat_ini
vital_signs         - loinc_code, value, unit per encounter
diagnoses           - ICD-10, condition per encounter
procedures          - ICD-9, per encounter
odontogram          - tooth conditions, per encounter
ohis_scores         - OHI-S per encounter
prescriptions       - resep per encounter
medications         - master obat, stok
dispense_records    - pengeluaran obat
billings            - tagihan per encounter
billing_items       - item tagihan
payments            - riwayat pembayaran
receivables         - piutang
tarifs              - daftar harga layanan
soap_templates      - template SOAP
audit_logs          - log aksi kritikal
satusehat_sync_log  - log status sync SATUSEHAT
```

### B. Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Field tidak valid |
| `DUPLICATE_ENTRY` | Data sudah ada |
| `INVALID_TRANSITION` | Status transition tidak valid |
| `INCOMPLETE_DOCUMENTATION` | Required clinical data belum diisi |
| `INSUFFICIENT_STOCK` | Stok obat tidak cukup |
| `ALREADY_DISPENSED` | Resep sudah di-dispense |
| `UNAUTHORIZED` | Tidak punya akses ke resource ini |
| `SATUSEHAT_SYNC_FAILED` | Gagal sync ke SATUSEHAT |
| `DISCOUNT_EXCEEDED` | Diskon melebihi batas maksimal |

### C. Role Permission Summary

| Endpoint Group | OWNER | ADMIN | DOKTER |
|----------------|-------|-------|--------|
| Auth | ✅ | ✅ | ✅ |
| User Management | ✅ | ❌ | ❌ |
| Patient Management | ✅ | ✅ | Read |
| Queue Management | ✅ | ✅ | Own |
| Encounter Management | ✅ | ✅ | Own |
| Clinical Documentation | ✅ | Read | Own |
| Billing & Payment | ✅ | ✅ | ❌ |
| Pharmacy | ✅ | ✅ | Read |
| Reporting - Visits | ✅ All | ✅ All | Own |
| Reporting - Financial | ✅ | ❌ | ❌ |
| Reporting - SATUSEHAT | ✅ | ❌ | ❌ |
| Settings | ✅ | Tarif Read | Template Own |
| Public Endpoints | - | - | - |

---

**END OF DOCUMENT**
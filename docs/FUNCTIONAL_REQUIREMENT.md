# FUNCTIONAL REQUIREMENT SPECIFICATION
# ApexRecord - Sistem Manajemen Klinik Kesehatan

**Versi:** 1.0  
**Tanggal:** 10 Juni 2026

---

## TABLE OF CONTENTS

1. [Module Overview](#1-module-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Patient Management](#3-patient-management)
4. [Queue Management](#4-queue-management)
5. [Encounter Management](#5-encounter-management)
6. [Clinical Documentation](#6-clinical-documentation)
7. [Billing & Payment](#7-billing--payment)
8. [Pharmacy Management](#8-pharmacy-management)
9. [Reporting](#9-reporting)
10. [Settings & Configuration](#10-settings--configuration)

---

## 1. MODULE OVERVIEW

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────┐
│          Frontend (Flutter Web/Mobile)          │
│  - UI Components                                │
│  - State Management                             │
│  - Offline Persistence                          │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│            Firebase Services                    │
│  - Authentication (Email/Password)              │
│  - Firestore (NoSQL Database)                   │
│  - Cloud Functions (Backend API)                │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│         External Integrations                   │
│  - SATUSEHAT API (FHIR R4)                     │
│  - Master Data Services                         │
└─────────────────────────────────────────────────┘
```

### 1.2 Functional Modules

| Module | Purpose | Primary Users |
|--------|---------|---------------|
| **Authentication & Authorization** | User login, role-based access | All users |
| **Patient Management** | Patient registration, demographics | Admin |
| **Queue Management** | Appointment booking, queue tracking | Admin, Patient (public) |
| **Encounter Management** | Visit tracking, status management | Admin, Dokter |
| **Clinical Documentation** | SOAP notes, diagnosis, procedures | Dokter |
| **Billing & Payment** | Invoicing, payment processing | Admin |
| **Pharmacy Management** | Prescription, medication dispensing | Admin, Dokter |
| **Reporting** | Analytics, compliance reports | Owner, Admin, Dokter |
| **Settings & Configuration** | Clinic setup, user management, tariffs | Owner |

---

## 2. AUTHENTICATION & AUTHORIZATION

### FR-AUTH-001: User Registration

**Priority:** Critical  
**Actor:** New User (Staff)

**Description:**  
System allows new staff to register with email and password. User assigned "pending" status until Owner activates.

**Inputs:**
- Email (valid format, unique)
- Password (minimum 8 characters)
- Full Name
- Optional: Owner Code (secret 8-character code)

**Processing:**
1. Validate email format and uniqueness
2. Validate password strength
3. Create Firebase Auth user
4. Send email verification
5. If Owner Code provided and valid:
   - Assign role: "owner"
   - Set isActive: true
6. Else:
   - Assign role: "pending"
   - Set isActive: false
7. Create user document in Firestore `users` collection

**Outputs:**
- User account created
- Verification email sent
- User redirected to email verification page

**Business Rules:**
- BR-AUTH-001: Email must be unique across system
- BR-AUTH-002: Password minimum 8 characters, at least 1 uppercase, 1 number, 1 special char (recommended)
- BR-AUTH-003: Owner Code is single-use or clinic-specific (⚠️ implementation unclear)
- BR-AUTH-004: Pending users polled every 10 seconds for activation status

**Success Criteria:**
- User successfully created in Firebase Auth
- Email verification sent
- User document created in Firestore

**Exception Handling:**
- Email already exists: Show error "Email sudah terdaftar"
- Weak password: Show validation errors
- Invalid Owner Code: Ignore code, proceed as pending user
- Network error: Show "Koneksi gagal, coba lagi"

---

### FR-AUTH-002: User Login

**Priority:** Critical  
**Actor:** All Users

**Description:**  
Registered users login with email and password. System validates credentials and routes to appropriate page based on role and status.

**Inputs:**
- Email
- Password

**Processing:**
1. Validate email format
2. Call Firebase Auth signInWithEmailAndPassword
3. Check email verification status
4. If verified:
   - Load user document from Firestore
   - Check role and isActive status
   - Route based on logic:
     - Owner + clinic setup incomplete → Setup Clinic Page
     - Owner + clinic setup complete → Menu Page
     - Admin/Dokter + isActive true → Menu Page
     - Pending/isActive false → Accept Pending Page
5. Store user session (Firebase handles token)

**Outputs:**
- User logged in
- Redirected to appropriate page
- User data loaded in app state

**Business Rules:**
- BR-AUTH-005: Email must be verified before login
- BR-AUTH-006: Inactive users cannot access main system
- BR-AUTH-007: Pending users see waiting page with polling
- BR-AUTH-008: Session persists until logout or token expiry

**Success Criteria:**
- User successfully authenticated
- Correct page routing based on role/status
- User data accessible in app

**Exception Handling:**
- Invalid credentials: "Email atau password salah"
- Email not verified: "Silakan verifikasi email terlebih dahulu"
- Account inactive: "Akun Anda belum diaktivasi oleh Owner"
- Network error: "Koneksi gagal"

---

### FR-AUTH-003: Role-Based Access Control

**Priority:** Critical  
**Actor:** System

**Description:**  
System enforces role-based menu and data access. Each role has predefined permissions.

**Processing:**
1. On app load, load user role from Firestore
2. Filter menu items based on `allowedRoles` property
3. For data access:
   - Firestore queries filtered by role:
     - All roles: Filter by `clinicId`
     - Dokter: Additional filter `practitionerId = userId`
   - UI components hidden/disabled based on role
4. API calls validate role server-side (Cloud Functions)

**Access Matrix:**
See [USER_ROLE_MATRIX.md](USER_ROLE_MATRIX.md) for complete matrix.

**Business Rules:**
- BR-AUTH-009: Client-side role check for UX, server-side for security
- BR-AUTH-010: Role cannot be changed by user (only Owner)
- BR-AUTH-011: Menu dynamically generated per role
- BR-AUTH-012: Data queries auto-filtered by role

**Success Criteria:**
- User sees only allowed menus
- Data access restricted per role
- Unauthorized actions blocked

---

## 3. PATIENT MANAGEMENT

### FR-PAT-001: Patient Search (NIK)

**Priority:** Critical  
**Actor:** Admin, Dokter (read-only)

**Description:**  
Search patient by NIK, integrates with SATUSEHAT API to fetch authoritative data.

**Inputs:**
- NIK (16 digits, formatted as XXXX-XXXX-XXXX-XXXX)

**Processing:**
1. Validate NIK format (16 digits, numeric)
2. Call Cloud Function `/searchPatient?nik={nik}`
3. Cloud Function calls SATUSEHAT API
4. If found:
   - Map FHIR Patient resource to UI format
   - Display: Name, DOB, Gender, Address, IHS Number
5. If not found in SATUSEHAT:
   - Search local Firestore by NIK
   - If found locally: Display
   - If not found: Show "Tidak ditemukan"

**Outputs:**
- Patient demographics displayed
- Option to "Lihat Detail" or "Daftar Baru"

**Business Rules:**
- BR-PAT-001: NIK must be exactly 16 digits
- BR-PAT-002: SATUSEHAT is authoritative source (if conflict, SATUSEHAT wins)
- BR-PAT-003: Search throttled (max 5 requests per minute per user)

**Success Criteria:**
- Patient found and displayed within 3 seconds
- Data accurate and up-to-date

**Exception Handling:**
- Invalid NIK format: Show validation error immediately
- SATUSEHAT API timeout: Fallback to local search
- Patient not found: Offer to register new

---

### FR-PAT-002: Patient Registration

**Priority:** Critical  
**Actor:** Admin

**Description:**  
Register new patient with demographic information, sync to SATUSEHAT.

**Inputs:**
- **Required:**
  - NIK (16 digits) or NIK Ibu (for babies)
  - Name
  - Birth Date (YYYY-MM-DD)
  - Gender (male/female)
- **Optional:**
  - Phone
  - Email
  - Address (street, city, postal code)
  - Marital Status
  - Birth Order (for multiple birth)

**Processing:**
1. Validate required fields
2. Check duplicate:
   - Query Firestore: `patients` where `nik == input` AND `clinicId == current`
   - If exists: Show duplicate warning
3. If baby without NIK:
   - Validate Mother's NIK
   - Set `nikIbu` field
4. Generate No. RM:
   - Query max No. RM for clinic
   - Increment by 1
   - Format: 6-digit zero-padded (000001, 000002, ...)
   - Use Firestore transaction for atomicity
5. Save to Firestore `patients/{patientId}`
6. Call Cloud Function `/createPatient`:
   - POST to SATUSEHAT `/Patient` endpoint
   - Receive IHS Number and SATUSEHAT Patient ID
   - Update Firestore with IDs
7. Set `syncStatus: synced` or `failed`

**Outputs:**
- Patient record created in Firestore
- No. RM assigned
- SATUSEHAT Patient ID stored
- Success message: "Pasien berhasil didaftarkan dengan No. RM: XXXXXX"

**Business Rules:**
- BR-PAT-004: No. RM unique per clinic
- BR-PAT-005: NIK unique per clinic (one patient = one record)
- BR-PAT-006: Baby without NIK uses mother's NIK + birth order
- BR-PAT-007: Local save always succeeds even if SATUSEHAT sync fails
- BR-PAT-008: Failed sync retried automatically every hour

**Success Criteria:**
- Patient created in <10 seconds
- No. RM generated correctly
- SATUSEHAT sync successful or queued for retry

**Exception Handling:**
- Duplicate NIK: "Pasien sudah terdaftar. No. RM: XXXXXX"
- SATUSEHAT API error: Save locally, mark sync failed
- Transaction conflict: Retry No. RM generation

---

### FR-PAT-003: Patient Update

**Priority:** High  
**Actor:** Admin

**Description:**  
Update patient demographics. Changes synced to SATUSEHAT.

**Inputs:**
- PatientId (from patient list selection)
- Fields to update (any editable field)

**Processing:**
1. Load patient document
2. Allow edit of:
   - Phone, Email
   - Address
   - Marital Status
3. Restrict edit of:
   - NIK (read-only after creation)
   - No. RM (read-only after creation)
   - Birth Date (requires Owner approval to change)
4. On save:
   - Update Firestore
   - PUT to SATUSEHAT `/Patient/{id}` with updated data
   - Update `syncStatus`

**Outputs:**
- Patient record updated
- Success message

**Business Rules:**
- BR-PAT-009: NIK and No. RM immutable after creation
- BR-PAT-010: Birth Date change requires Owner approval (audit trail)
- BR-PAT-011: SATUSEHAT sync uses PUT (update existing resource)

**Success Criteria:**
- Updates reflected in <5 seconds
- SATUSEHAT synced

**Exception Handling:**
- SATUSEHAT 404: Patient not found in SATUSEHAT, treat as new (POST)
- Validation error: Show specific field errors

---

## 4. QUEUE MANAGEMENT

### FR-QUE-001: Online Booking (Public)

**Priority:** High  
**Actor:** Patient (Public, No Login)

**Description:**  
Patients book appointment online via public URL, select doctor and time slot.

**Inputs:**
- Clinic ID (from URL parameter or dropdown)
- Tanggal (date picker)
- Doctor (dropdown)
- Time Slot (dropdown, 30-min intervals)
- Patient Name
- Phone Number
- Chief Complaint (text)
- First Visit? (checkbox)

**Processing:**
1. Public page loads clinic info:
   - Call `/getKlinikInfo?clinicId={id}`
   - Display clinic name, address, hours
2. Load available slots:
   - Call `/getJadwalHariIni?clinicId={id}&tanggal={date}`
   - Display doctors with schedules
   - Generate 30-min slots from jamBuka to jamTutup
   - Mark booked slots as unavailable
3. User selects doctor and slot
4. User fills form (name, phone, complaint)
5. On submit:
   - Call `/daftarAntrian` (POST)
   - Server-side check: slot still available?
   - If available:
     - Generate queue number (sequential per clinic per day)
     - Generate 8-char token (verification)
     - Save to Firestore `antrian`
     - Status: "waiting"
   - Return: Queue number + Token
6. Display confirmation page:
   - Queue number
   - Token (for checking status)
   - Clinic address and map
   - Reminder to come 15 min early

**Outputs:**
- Booking confirmed
- Queue number assigned
- Token generated
- Confirmation displayed

**Business Rules:**
- BR-QUE-001: One slot = one patient per doctor
- BR-QUE-002: Booking closes 1 hour before appointment *(not enforced)*
- BR-QUE-003: Can book up to 7 days advance *(not enforced)*
- BR-QUE-004: Queue number resets daily
- BR-QUE-005: Token valid for 24 hours

**Success Criteria:**
- Booking completed in <30 seconds
- No double booking
- Token immediately usable for status check

**Exception Handling:**
- Slot taken (race condition): "Maaf, slot sudah penuh. Pilih waktu lain."
- Clinic not found: "Klinik tidak ditemukan"
- No available slots: "Tidak ada slot tersedia untuk tanggal ini"

---

### FR-QUE-002: Check Queue Status (Public)

**Priority:** Medium  
**Actor:** Patient (Public)

**Description:**  
Patient checks queue position using 8-character token.

**Inputs:**
- Token (8 characters, alphanumeric)

**Processing:**
1. Call `/getAntrianStatus?token={token}`
2. Query `antrian` collection by token
3. Calculate:
   - Current position (count of earlier queues with status waiting/confirmed)
   - Estimated wait time = position × 15 minutes
   - Currently called number (max nomorAntrian with status="called")
4. Return:
   - Queue number
   - Current position
   - Estimated wait time
   - Status (waiting/confirmed/called/done)
   - Currently called number

**Outputs:**
- Queue status displayed
- Position and wait time shown
- Real-time update (manual refresh or auto-refresh every 30s)

**Business Rules:**
- BR-QUE-006: Token required for status check (no login needed)
- BR-QUE-007: Wait time estimated at 15 min per patient
- BR-QUE-008: Status updates real-time via Firestore listener

**Success Criteria:**
- Status retrieved in <2 seconds
- Accurate position calculation

**Exception Handling:**
- Invalid token: "Token tidak ditemukan"
- Expired booking: "Antrian sudah melewati waktu"

---

### FR-QUE-003: Admin Queue Management

**Priority:** Critical  
**Actor:** Admin

**Description:**  
Admin manages daily queue, confirms bookings, calls patients, tracks status.

**Inputs:**
- Date filter (default: today)
- Doctor filter (default: all)
- Status filter (default: waiting, confirmed, called)

**Processing:**
1. Load queue list from Firestore:
   ```
   antrian
   WHERE clinicId = current
   AND tanggal = selected
   AND practitionerId = selected (if filtered)
   AND status IN (waiting, confirmed, called)
   ORDER BY nomorAntrian ASC
   ```
2. Display as table:
   - No. Antrian
   - Nama Pasien
   - No. HP
   - Dokter
   - Jam Slot
   - Status
   - Actions (buttons)
3. Admin actions:
   - **Confirm Booking:** waiting → confirmed
   - **Call Patient:** confirmed → called (set calledAt timestamp)
   - **Mark Done:** called → done (set doneAt timestamp)
   - **Cancel:** any → cancelled (input reason)

**Outputs:**
- Queue list displayed
- Status updates reflected real-time
- Metrics: Total, Waiting, Called, Done

**Business Rules:**
- BR-QUE-009: Only Admin can update status
- BR-QUE-010: Status can only move forward (except cancel)
- BR-QUE-011: Called status triggers waiting room display

**Success Criteria:**
- Queue updates in <1 second
- No status transition errors

---

### FR-QUE-004: Waiting Room Monitor Display

**Priority:** Medium  
**Actor:** Patient (viewing display), Admin (controls content)

**Description:**  
Large screen displays currently called queue numbers for patients in waiting room.

**Processing:**
1. Real-time Firestore listener:
   ```
   antrian
   WHERE clinicId = current
   AND tanggal = today
   AND status = "called"
   ORDER BY calledAt DESC
   LIMIT 5
   ```
2. Display:
   - Large font: Latest called number
   - List: Next 4 called numbers
   - Doctor name and room
   - Clock
3. Auto-refresh: Real-time updates

**Outputs:**
- Display updated instantly when Admin calls queue
- Patient sees their number and proceeds to exam room

**Business Rules:**
- BR-QUE-012: Display only "called" status
- BR-QUE-013: Show max 5 recent calls
- BR-QUE-014: Auto-scroll if more than 5

---

## 5. ENCOUNTER MANAGEMENT

### FR-ENC-001: Create Encounter

**Priority:** Critical  
**Actor:** Admin, Dokter

**Description:**  
Create encounter (kunjungan) for patient, either from queue or walk-in.

**Inputs:**
- **From Queue:**
  - Queue ID (auto-filled from selected queue)
  - Patient ID (auto-filled)
  - Practitioner ID (auto-filled)
- **Walk-In:**
  - Patient ID (search and select)
  - Practitioner ID (dropdown)
  - Location ID (dropdown)
  - Chief Complaint (text)
  - Service Type (dropdown: outpatient/inpatient/emergency)

**Processing:**
1. Validate:
   - Patient exists
   - Practitioner active
   - Location available
2. Create encounter document:
   ```
   encounters/{encounterId}
   {
     encounterId: auto-generated
     clinicId: current
     patientId, patientName
     practitionerId, practitionerName
     locationId, locationName
     status: "arrived"
     serviceType: "outpatient" (default)
     chiefComplaint: from input or queue
     arrivedTime: now()
     createdBy: userId
     createdAt: now()
   }
   ```
3. If from queue:
   - Link encounter to queue: `queueId` field
   - Optionally update queue status to "done" *(not automatic)*
4. Save to Firestore
5. Optionally sync to SATUSEHAT (create Encounter resource)

**Outputs:**
- Encounter created
- Encounter ID generated
- Redirected to encounter detail page

**Business Rules:**
- BR-ENC-001: One queue can create one encounter
- BR-ENC-002: One patient can have multiple encounters per day (different doctors)
- BR-ENC-003: Default status: "arrived"
- BR-ENC-004: Default service type: "outpatient"
- BR-ENC-005: Encounter creation does not auto-change queue status

**Success Criteria:**
- Encounter created in <3 seconds
- Dokter can immediately start documentation

**Exception Handling:**
- Patient not found: "Silakan daftarkan pasien terlebih dahulu"
- Practitioner inactive: "Dokter tidak aktif"

---

### FR-ENC-002: Update Encounter Status

**Priority:** Critical  
**Actor:** Admin, Dokter

**Description:**  
Update encounter status through lifecycle: arrived → in-progress → finished.

**Inputs:**
- Encounter ID
- New status (dropdown: in-progress, finished, cancelled)
- Reason (required if cancelled)

**Processing:**
1. Load encounter document
2. Validate status transition:
   - arrived → in-progress: OK
   - arrived → cancelled: OK (reason required)
   - in-progress → finished: OK (requires validation)
   - in-progress → cancelled: OK (reason required)
   - Other transitions: Error
3. If status = "finished":
   - Validate required fields:
     - At least one anamnesis entry (keluhan utama)
     - At least one vital sign
     - At least one diagnosis
   - If validation fails: Block and show error
4. Update encounter:
   - Set status field
   - Set timestamp:
     - in-progress: inProgressTime = now()
     - finished: finishedTime = now()
   - If finished: Trigger SATUSEHAT sync
5. Save to Firestore

**Outputs:**
- Status updated
- Timestamp recorded
- If finished: Sync initiated

**Business Rules:**
- BR-ENC-006: Status can only move forward
- BR-ENC-007: Finished requires complete documentation
- BR-ENC-008: Finished encounter triggers SATUSEHAT sync
- BR-ENC-009: Once finished, clinical tabs become read-only

**Success Criteria:**
- Status updated instantly
- Validation prevents incomplete finalization

**Exception Handling:**
- Invalid transition: "Status tidak dapat diubah dari X ke Y"
- Incomplete documentation: "Harap lengkapi [list] sebelum finish"
- SATUSEHAT sync failure: Encounter still marked finished locally, sync queued for retry

---

## 6. CLINICAL DOCUMENTATION

### FR-DOC-001: Anamnesis Entry

**Priority:** Critical  
**Actor:** Dokter

**Description:**  
Record subjective patient information including chief complaint, medical history, allergies, current medications.

**Inputs:**
- Encounter ID (context)
- **Fields:**
  - Keluhan Utama (Chief Complaint) - text area
  - Riwayat Penyakit (Medical History) - text area
  - Golongan Darah (A/B/AB/O) - dropdown
  - Rhesus (+/-) - dropdown
  - Status Kehamilan (Pregnant/Not Pregnant) - dropdown (female only)
  - Alergi - array of {substansi, reaksi, tingkat}
  - Riwayat Obat - array of {namaObat, dosis, frekuensi}

**Processing:**
1. Load encounter context
2. Render form with fields
3. For female patients: Show pregnancy status field
4. Alergi section:
   - "Tambah Alergi" button
   - Dynamic form rows (substansi, reaksi, tingkat dropdown)
   - "Hapus" button per row
5. Riwayat Obat section:
   - "Tambah Obat" button
   - Dynamic form rows (nama, dosis, frekuensi)
   - "Hapus" button per row
6. On "Simpan":
   - Save to Firestore:
     ```
     encounters/{encId}/anamnesis/anamnesis
     ```
   - If encounter status = "finished":
     - Trigger SATUSEHAT sync:
       - Keluhan Utama → Condition (category: chief-complaint)
       - Riwayat Penyakit → Condition (category: problem-list-item)
       - Golongan Darah → Observation (LOINC blood type)
       - Rhesus → Observation (LOINC Rh)
       - Pregnancy Status → Observation (SNOMED pregnancy status)
       - Each Alergi → AllergyIntolerance resource
       - Each Riwayat Obat → MedicationStatement resource

**Outputs:**
- Anamnesis saved
- SATUSEHAT resources created (if applicable)
- Success message

**Business Rules:**
- BR-DOC-001: Keluhan Utama required before encounter finish
- BR-DOC-002: Pregnancy field only for female patients
- BR-DOC-003: Each alergi becomes separate FHIR resource
- BR-DOC-004: Auto-save on blur (optional)

**Success Criteria:**
- Data saved in <2 seconds
- SATUSEHAT sync successful

---

### FR-DOC-002: Vital Signs Entry

**Priority:** Critical  
**Actor:** Dokter

**Description:**  
Record objective clinical measurements.

**Inputs:**
- Encounter ID
- **Measurements:**
  - Systolic BP (60-250 mmHg)
  - Diastolic BP (40-150 mmHg)
  - Heart Rate (30-250 /min)
  - Respiratory Rate (10-60 /min)
  - Body Temperature (34-42 °C, decimal allowed)

**Processing:**
1. Render input fields with validation
2. Show normal range hints (e.g., "Normal: 90-120")
3. On input:
   - Validate range (show warning if out of range, but allow save)
   - Allow decimal for temperature
4. On "Simpan":
   - Save each vital sign to:
     ```
     encounters/{encId}/vitalSigns/{loincCode}
     ```
   - Document ID = LOINC code (upsert on re-save)
   - If encounter finished:
     - Sync to SATUSEHAT as Observation resources
     - DateTime offset trick: 0s, 2s, 4s, 6s, 8s to prevent duplicate detection

**Outputs:**
- Vital signs saved
- Chart displayed (if historical data exists)

**Business Rules:**
- BR-DOC-005: At least one vital sign recommended
- BR-DOC-006: Out-of-range values show warning but saveable
- BR-DOC-007: Each vital sign = one Observation resource
- BR-DOC-008: Historical trend chart displayed

**Success Criteria:**
- Save in <2 seconds
- Validation immediate feedback

---

### FR-DOC-003: Diagnosis Entry (ICD-10)

**Priority:** Critical  
**Actor:** Dokter

**Description:**  
Record diagnosis using ICD-10 codes.

**Inputs:**
- Encounter ID
- **Per Diagnosis:**
  - ICD-10 Code (autocomplete search)
  - Description (from ICD-10 master)
  - Clinical Status (active/inactive/resolved/recurrence/relapse/remission)
  - Category (encounter-diagnosis/problem-list-item)
  - Body Site (SNOMED code, dropdown with whitelist)
  - Onset Date (optional)
  - Note (optional)

**Processing:**
1. ICD-10 Search:
   - Autocomplete from `assets/icd/icd10.json`
   - Search by code or description
   - Fuzzy matching
   - Show max 25 results
2. On select:
   - Auto-fill code and description
3. Body Site dropdown:
   - Show only whitelisted SNOMED codes (40+ oral/dental anatomy codes)
4. On "Tambah Diagnosis":
   - Save to:
     ```
     encounters/{encId}/conditions/{conditionId}
     ```
   - If encounter finished:
     - Sync to SATUSEHAT as Condition resource
5. Multiple diagnoses allowed

**Outputs:**
- Diagnosis added to list
- SATUSEHAT Condition ID returned

**Business Rules:**
- BR-DOC-009: At least one diagnosis required to finish encounter
- BR-DOC-010: Only whitelisted SNOMED codes for body site
- BR-DOC-011: First diagnosis = primary diagnosis
- BR-DOC-012: Can add unlimited secondary diagnoses

**Success Criteria:**
- ICD-10 search responsive (<500ms)
- Diagnosis saved in <2 seconds

---

### FR-DOC-004: Odontogram (Dental Chart)

**Priority:** Medium (Dental-specific)  
**Actor:** Dokter (Dentist)

**Description:**  
Visual dental chart to record tooth conditions.

**Inputs:**
- Encounter ID
- **Per Tooth (52 teeth total):**
  - Tooth number (FDI notation: 11-18, 21-28, 31-38, 41-48, 51-55, 61-65, 71-75, 81-85)
  - Surface conditions (mesial, distal, bukal, palatal, occlusal):
     - karies, komposit, gic, amalgam, etc.
  - Overall status (above): SOU, ATT, PRE, UNE, ANO, NON
  - Overall status (below): MISSING, CFR, RRX
  - RCT checkbox
- **Summary:**
  - Decayed count
  - Missing count
  - Filled count
  - DMF-T = D + M + F
- **Additional Findings:**
  - Occlusion type, Torus, Palatum, Diastema, Anomaly

**Processing:**
1. Render interactive dental chart (visual tooth diagram)
2. Click tooth to open detail form
3. Select surface and condition from dropdown
4. Mark status with predefined codes
5. System auto-calculates DMF-T
6. On "Simpan":
   - Save to:
     ```
     encounters/{encId}/odontogram/{doc}
     ```
   - If encounter finished:
     - Smart Sync to SATUSEHAT:
       1. GET existing Observations for this encounter
       2. Map by tooth label + SNOMED code
       3. If exists: PUT (update)
       4. If new: POST (create)
       - Each tooth condition = one Observation
       - DMF-T summary = separate Observations (D count, M count, F count)

**Outputs:**
- Odontogram saved
- DMF-T calculated
- SATUSEHAT Observations created/updated

**Business Rules:**
- BR-DOC-013: Optional for non-dental encounters
- BR-DOC-014: Smart sync prevents duplicate creation
- BR-DOC-015: Historical comparison available

**Success Criteria:**
- Chart interactive and intuitive
- Save in <5 seconds
- Smart sync prevents errors

---

### FR-DOC-005: Procedure Entry (ICD-9)

**Priority:** High  
**Actor:** Dokter

**Description:**  
Record procedures performed during encounter.

**Inputs:**
- Encounter ID
- **Per Procedure:**
  - Procedure Code (ICD-9-CM)
  - Procedure Name
  - Status (preparation/in-progress/completed/not-done/stopped)
  - Performed Start DateTime
  - Performed End DateTime (optional)
  - Reason (ICD-10 diagnosis code, link to diagnosis)
  - Tooth Number (for dental procedures)
  - Note (optional)

**Processing:**
1. Predefined templates or manual entry:
   - Dental Scaling (96.54)
   - Root Canal (23.71)
   - Tooth Extraction (23.09)
   - Dental Restoration (23.2)
   - Custom (enter code manually)
2. On template select:
   - Auto-fill code and name
3. Link to diagnosis:
   - Dropdown of diagnoses from current encounter
4. On "Simpan":
   - Save to:
     ```
     encounters/{encId}/procedures/{procedureId}
     ```
   - If encounter finished:
     - Sync to SATUSEHAT as Procedure resource
     - Link to diagnosis via reasonReference

**Outputs:**
- Procedure added to list
- SATUSEHAT Procedure ID returned

**Business Rules:**
- BR-DOC-016: Multiple procedures per encounter allowed
- BR-DOC-017: Procedure code must be valid ICD-9-CM
- BR-DOC-018: Performed datetime cannot be in future
- BR-DOC-019: Procedures linked to tarif for billing

**Success Criteria:**
- Procedure saved in <2 seconds
- Template selection speeds entry

---

### FR-DOC-006: Prescription (E-Resep)

**Priority:** High  
**Actor:** Dokter

**Description:**  
Write electronic prescription for medications.

**Inputs:**
- Encounter ID
- **Per Medication:**
  - Medication Name (autocomplete from drug database)
  - Strength (e.g., "500mg")
  - Dosage Form (tablet/kapsul/sirup/injeksi)
  - Dosage Instruction (e.g., "3x1 tablet sesudah makan")
  - Quantity
  - Duration (number + unit: days/weeks)
  - Note (optional)

**Processing:**
1. Drug search:
   - Autocomplete from `medications` collection
   - Search by name or generic name
2. On select:
   - Auto-fill strength and form
3. Input dosage instruction (free text or template)
4. On "Tambah Resep":
   - Save to:
     ```
     encounters/{encId}/prescriptions/{prescriptionId}
     ```
   - Status: "active"
   - If encounter finished:
     - Sync to SATUSEHAT as MedicationRequest resource
5. Multiple medications allowed

**Outputs:**
- Prescription added to list
- Prescription printable
- Admin can dispense from pharmacy module

**Business Rules:**
- BR-DOC-020: Prescription requires licensed practitioner
- BR-DOC-021: Cannot modify after dispensed
- BR-DOC-022: Prescription validity: 30 days *(not enforced)*
- BR-DOC-023: Duplicate medication check (warning)

**Success Criteria:**
- Prescription entry <1 minute per drug
- Print function works

---

## 7. BILLING & PAYMENT

### FR-BILL-001: Billing Input

**Priority:** Critical  
**Actor:** Admin

**Description:**  
Create invoice for encounter, add service items, apply discounts.

**Inputs:**
- Encounter ID
- **Service Items:**
  - Service Name (from tarif list)
  - Quantity
  - Unit Price (from tarif)
  - Discount per item (% or Rp)
  - Subtotal
- **Total-level Discount** (% or Rp)
- **Payment Method** (cash/transfer/insurance)
- **Amount Paid**

**Processing:**
1. Load encounter details
2. Load tarif list (filtered by clinic)
3. Admin selects services:
   - Click "Tambah Item"
   - Select from tarif dropdown
   - Set quantity (default: 1)
   - Unit price auto-filled from tarif
   - Can apply discount (within max discount limit from tarif)
   - Subtotal = (quantity × price) - discount
4. Calculate total:
   - Sum all subtotals
   - Apply total-level discount
   - Grand total = sum - total discount
5. On "Simpan":
   - Save to:
     ```
     billings/{billingId}
     {
       billingId: auto-generated
       encounterId
       patientId, patientName
       items: [{name, qty, price, discount, subtotal}]
       totalDiscount
       grandTotal
       createdBy: userId
       createdAt: now()
       status: "unpaid"
     }
     ```

**Outputs:**
- Billing document created
- Invoice generated (PDF)
- Ready for payment processing

**Business Rules:**
- BR-BILL-001: Tarif configured by Owner
- BR-BILL-002: Admin can only discount within allowed limit
- BR-BILL-003: Price changes do not affect existing billings
- BR-BILL-004: One encounter can have multiple billings (amendments)

**Success Criteria:**
- Billing created in <1 minute
- Invoice accurate

---

### FR-BILL-002: Payment Processing

**Priority:** Critical  
**Actor:** Admin

**Description:**  
Process payment for billing, handle partial payments.

**Inputs:**
- Billing ID
- Payment Method (cash/transfer/insurance)
- Amount Paid
- Payment Note (optional, e.g., transfer proof reference)

**Processing:**
1. Load billing document
2. Display grand total
3. Admin inputs amount paid
4. System calculates:
   - Outstanding = Grand Total - Amount Paid
5. If Amount Paid >= Grand Total:
   - Status: "paid"
   - Save payment record
   - Generate receipt
6. If Amount Paid < Grand Total:
   - Status: "partial"
   - Create receivable record:
     ```
     receivables/{receiv_id}
     {
       billingId
       patientId
       totalAmount: Grand Total
       paidAmount: Amount Paid
       outstandingAmount: Outstanding
       paymentHistory: [{date, amount, method}]
     }
     ```
   - Generate partial receipt
7. On "Simpan":
   - Update billing status
   - Create transaction record
   - Print receipt

**Outputs:**
- Payment recorded
- Receipt printed
- If partial: Receivable created

**Business Rules:**
- BR-BILL-005: Partial payment allowed
- BR-BILL-006: Min first payment: 30% *(not enforced)*
- BR-BILL-007: Outstanding tracked in receivables
- BR-BILL-008: Subsequent payments added to payment history

**Success Criteria:**
- Payment processed in <2 minutes
- Receipt accurate

---

### FR-BILL-003: Invoice Generation

**Priority:** High  
**Actor:** Admin

**Description:**  
Generate and print invoice PDF.

**Inputs:**
- Billing ID

**Processing:**
1. Load billing document
2. Load clinic info (header)
3. Load patient info
4. Generate PDF:
   - Header: Clinic name, address, phone
   - Invoice #, Date
   - Patient: Name, No. RM
   - Table: Service items, qty, price, discount, subtotal
   - Total discount
   - Grand total
   - Payment method, amount paid, outstanding
   - Footer: Kasir signature
5. Open print dialog

**Outputs:**
- PDF invoice
- Print action

**Business Rules:**
- BR-BILL-009: Invoice number sequential per clinic
- BR-BILL-010: Invoice immutable after print *(not enforced)*

---

## 8. PHARMACY MANAGEMENT

### FR-PHARM-001: Medication Dispensing

**Priority:** High  
**Actor:** Admin, Pharmacist

**Description:**  
Dispense medications based on prescriptions, deduct stock.

**Inputs:**
- Patient ID or Encounter ID
- Prescription ID

**Processing:**
1. Load active prescriptions for patient
2. Display:
   - Drug name, strength, form
   - Quantity prescribed
   - Dosage instruction
   - Current stock level
3. For each prescription item:
   - Check stock:
     - If stock >= quantity: OK
     - If stock < quantity: Show warning "Stok tidak cukup"
   - Input quantity dispensed (default: prescribed quantity)
   - Optional: Offer alternative drug if out of stock
4. On "Keluarkan Obat":
   - Deduct stock:
     ```
     medications/{drugId}
     quantity = quantity - dispensedQty
     ```
   - Update prescription status: "dispensed"
   - Save dispensing record:
     ```
     dispensing/{dispenseId}
     {
       prescriptionId
       patientId
       encounterId
       items: [{drugId, qty, batchNo}]
       dispensedBy: userId
       dispensedAt: now()
     }
     ```
   - Print label (drug name, dosage, patient name, date)

**Outputs:**
- Stock deducted
- Prescription marked dispensed
- Label printed

**Business Rules:**
- BR-PHARM-001: Cannot dispense if stock insufficient
- BR-PHARM-002: Alert when stock reaches minStock
- BR-PHARM-003: FIFO for expiration management *(not enforced)*
- BR-PHARM-004: Prescription status prevents double dispensing

**Success Criteria:**
- Dispensing processed in <3 minutes
- Stock accurate

**Exception Handling:**
- Out of stock: Offer alternative or note "Patient buy outside"

---

### FR-PHARM-002: Stock Management

**Priority:** Medium  
**Actor:** Admin, Owner

**Description:**  
Manage medication inventory.

**Inputs:**
- Drug Name, Generic Name
- Strength, Unit
- Dosage Form
- Quantity, Min Stock
- Price, Supplier
- Expiration Date

**Processing:**
1. CRUD operations on `medications` collection
2. Stock adjustment:
   - Manual entry (stock in/out/adjustment)
   - Reason required
   - ⚠️ No transaction log *(gap)*
3. Low stock alert:
   - Query: `quantity <= minStock`
   - Display warning badge
4. Expiration alert:
   - Query: `expirationDate <= now() + 30 days`
   - Display warning

**Outputs:**
- Medication master updated
- Alerts displayed

**Business Rules:**
- BR-PHARM-005: Low stock alert at reorder point
- BR-PHARM-006: Expiration alert 30 days before

---

## 9. REPORTING

### FR-REP-001: Visit Report

**Priority:** High  
**Actor:** Owner, Admin, Dokter

**Description:**  
Statistics and list of encounters.

**Inputs:**
- Date range (from, to)
- Doctor filter (for Dokter: auto-filtered to self)
- Status filter (all/arrived/in-progress/finished/cancelled)

**Processing:**
1. Query encounters:
   ```
   encounters
   WHERE clinicId = current
   AND createdAt BETWEEN from AND to
   AND practitionerId = filter (if Dokter: userId)
   AND status = filter (if selected)
   ```
2. Calculate metrics:
   - Total encounters
   - By status (count each)
   - By service type
   - Avg duration (finishedTime - arrivedTime)
3. Display:
   - Summary cards (metrics)
   - Table: Date, Patient, Dokter, Status, Duration
   - Export button (CSV/PDF)

**Outputs:**
- Report displayed
- Exportable data

**Business Rules:**
- BR-REP-001: Owner sees all encounters
- BR-REP-002: Admin sees all encounters
- BR-REP-003: Dokter sees own encounters only

---

### FR-REP-002: Financial Report (Owner Only)

**Priority:** High  
**Actor:** Owner

**Description:**  
Revenue, collections, receivables analysis.

**Inputs:**
- Date range
- Report type (summary/detailed)

**Processing:**
1. Query billings:
   ```
   billings
   WHERE clinicId = current
   AND createdAt BETWEEN from AND to
   ```
2. Calculate:
   - Total billings
   - Total paid
   - Total outstanding (receivables)
   - Collection rate = (paid / billings) × 100%
   - Revenue by service category
   - Revenue by doctor
3. Generate charts:
   - Line chart: Daily revenue trend
   - Pie chart: Revenue by service
   - Bar chart: Doctor performance

**Outputs:**
- Financial dashboard
- Charts and graphs
- Export to PDF/Excel

**Business Rules:**
- BR-REP-004: Owner exclusive access
- BR-REP-005: Real-time data (no caching)

---

### FR-REP-003: SATUSEHAT Sync Report (Owner Only)

**Priority:** Medium  
**Actor:** Owner

**Description:**  
Monitor SATUSEHAT integration health.

**Inputs:**
- Date range

**Processing:**
1. Query all resources with sync status:
   - Patients, Encounters, Conditions, Procedures, Observations, etc.
2. Count:
   - Total resources
   - Synced count
   - Failed count
   - Pending count
   - Sync rate = (synced / total) × 100%
3. List failed syncs with error details
4. "Retry All" button

**Outputs:**
- Sync status dashboard
- Failed items list with errors
- Retry action

**Business Rules:**
- BR-REP-006: Owner can view sync errors
- BR-REP-007: Owner can trigger manual retry

---

## 10. SETTINGS & CONFIGURATION

### FR-SET-001: Clinic Setup (First-Time Owner)

**Priority:** Critical  
**Actor:** Owner (First-Time)

**Description:**  
Setup wizard for new clinic registration.

**Steps:**
1. **Clinic Info:**
   - Name, Address, Phone, Email
   - SIP (Surat Izin Praktik)
   - Operational Hours (per day)
2. **SATUSEHAT Config:**
   - Client ID, Client Secret
   - Environment (Sandbox/Production)
   - Test Connection button
3. **Organization Registration:**
   - POST to SATUSEHAT `/Organization`
   - Receive Organization ID
4. **Location Registration:**
   - Location Name, Type (HOSP, ER, etc.)
   - POST to SATUSEHAT `/Location`
   - Link to Organization
5. **Complete:**
   - Mark `clinicSetupComplete: true`
   - Redirect to Menu Page

**Outputs:**
- Clinic configured
- SATUSEHAT integrated
- Organization and Location registered

**Business Rules:**
- BR-SET-001: Required for first Owner login
- BR-SET-002: Cannot access system until complete
- BR-SET-003: Can edit later in Settings

---

### FR-SET-002: User Management (Owner Only)

**Priority:** Critical  
**Actor:** Owner

**Description:**  
Activate pending users, assign roles, manage access.

**Inputs:**
- User list (pending + active)

**Processing:**
1. Load users from Firestore:
   ```
   users
   WHERE clinicId = current
   ORDER BY isActive ASC, createdAt DESC
   ```
2. Display two tabs:
   - **Pending Users:** isActive = false, role = pending
   - **Active Users:** isActive = true
3. For pending users:
   - Show: Name, Email, Registration Date
   - Action: "Aktivasi" button
   - On click:
     - Modal: Select Role (Admin/Dokter)
     - If Dokter: Select Practitioner ID (link to practitioner)
     - Confirm
     - Update: role = selected, isActive = true
4. For active users:
   - Show: Name, Email, Role, Status
   - Action: "Nonaktifkan" button
   - On click:
     - Confirmation dialog
     - Update: isActive = false

**Outputs:**
- Users activated/deactivated
- Roles assigned

**Business Rules:**
- BR-SET-004: Owner exclusive access
- BR-SET-005: Cannot deactivate self
- BR-SET-006: Dokter requires practitioner linkage

---

### FR-SET-003: Practitioner Management (Owner Only)

**Priority:** High  
**Actor:** Owner

**Description:**  
Register doctors to SATUSEHAT.

**Inputs:**
- Search Method: By NIK or By Name+DOB+Gender

**Processing:**
1. **Search SATUSEHAT:**
   - Call `/searchPractitioner?nik={nik}` or `/searchPractitioner?name={name}&birthdate={dob}&gender={g}`
2. If found:
   - Display: Name, NIK, SATUSEHAT Practitioner ID
   - "Daftarkan" button
   - On click:
     - Save to Firestore:
       ```
       practitioners/{practitionerId}
       {
         satusehatPractitionerId
         nik, name, birthDate, gender
         specialization (input by Owner)
         role: "dokter" (default)
         clinicId
         isActive: true
       }
       ```
3. If not found:
   - Manual entry form
   - POST to SATUSEHAT `/Practitioner`
   - Save to Firestore

**Outputs:**
- Practitioner registered
- Available for assignment to users and encounters

**Business Rules:**
- BR-SET-007: Practitioner must be in SATUSEHAT
- BR-SET-008: One practitioner can work at multiple clinics

---

### FR-SET-004: Tarif & Tindakan (Owner Only)

**Priority:** High  
**Actor:** Owner

**Description:**  
Configure service pricing.

**Inputs:**
- Service Name
- Category (Konsultasi, Tindakan, Lab, etc.)
- ICD-9 Code (link to procedure, optional)
- Base Cost
- Selling Price
- Max Discount (% or Rp)

**Processing:**
1. CRUD on `tarifHarga` collection
2. Pricing models:
   - Fixed price
   - Range pricing (min-max)
   - Package pricing (bundle)
3. Discount rules:
   - Set max discount per service
   - Admin cannot exceed limit

**Outputs:**
- Tarif list configured
- Available in billing module

**Business Rules:**
- BR-SET-009: Tarif changes do not affect past billings
- BR-SET-010: Discount limit enforced

---

### FR-SET-005: SATUSEHAT Configuration (Owner Only)

**Priority:** High  
**Actor:** Owner

**Description:**  
Configure and test SATUSEHAT integration.

**Inputs:**
- Client ID
- Client Secret
- Environment (Sandbox/Production toggle)

**Processing:**
1. Input credentials
2. Click "Test Connection"
3. System:
   - Call `/oauth2/v1/accesstoken`
   - If success: Show "Koneksi berhasil" + token info
   - If fail: Show error message
4. On save:
   - Encrypt credentials (⚠️ verify encryption)
   - Save to Firestore:
     ```
     clinics/{clinicId}
     satusehatConfig: {
       clientId: encrypted
       clientSecret: encrypted
       environment: sandbox/production
     }
     ```

**Outputs:**
- SATUSEHAT configured
- Integration active

**Business Rules:**
- BR-SET-011: Credentials encrypted at rest
- BR-SET-012: Test connection before save
- BR-SET-013: Can toggle sandbox/production

---

### FR-SET-006: SOAP Templates (Owner, Dokter)

**Priority:** Medium  
**Actor:** Owner, Dokter

**Description:**  
Create reusable SOAP note templates.

**Inputs:**
- Template Name
- Template Content (for each SOAP section: S, O, A, P)

**Processing:**
1. Create template:
   ```
   templates/{templateId}
   {
     name
     sections: {
       subjective: "...",
       objective: "...",
       assessment: "...",
       plan: "..."
     }
     createdBy: userId
     isShared: true/false (Owner can share to all dokters)
   }
   ```
2. Use template:
   - Dokter selects template from dropdown in encounter
   - Content auto-fills in respective tabs
   - Dokter can edit after fill

**Outputs:**
- Template created
- Available for quick documentation

**Business Rules:**
- BR-SET-014: Dokter can create personal templates
- BR-SET-015: Owner can create shared templates
- BR-SET-016: Templates speed up documentation

---

**END OF DOCUMENT**

This functional requirement document provides detailed specifications for each feature based on the analyzed source code. Each requirement includes inputs, processing logic, outputs, business rules, success criteria, and exception handling.

For implementation details, refer to the actual source code in the repository.

# BACKEND DEVELOPMENT TASK BREAKDOWN
# ApexRecord - NestJS + MySQL

**Project:** ApexRecord - Sistem Manajemen Klinik Kesehatan  
**Stack:** NestJS + TypeORM + MySQL 8.0+  
**Generated:** 2026-06-11  
**Total Estimated:** ~360 jam (45 hari kerja @ 8 jam/hari)

---

## EXECUTIVE SUMMARY

### Resource Allocation
- **1 Backend Developer:** ~45 hari (solo)
- **2 Backend Developers:** ~25-30 hari (parallel work)
- **3 Backend Developers:** ~20 hari (optimal for this project size)

### Priority Distribution
- **Critical (P0):** 18 tasks - Must complete firstKamu adalah senior backend developer & tech lead. Berdasarkan dokumen berikut, buatkan breakdown task lengkap untuk Backend NestJS + MySQL.

## Dokumen
[paste isi doc — FUNCTIONAL_REQUIREMENT / APPROVAL_WORKFLOW / API_SPEC / USER_ROLE_MATRIX / NESTJS_ENTITIES / DATABASE_DDL]

## Output yang dibutuhkan:
Breakdown task dalam format tabel per module:

| No | Module | Task | Estimasi | Priority | Status |
|----|--------|------|----------|----------|--------|

## Cakupan task BE:
- Project setup & konfigurasi (TypeORM, ENV, dll)
- Database migration
- Entity & DTO
- Service & business logic
- Controller & endpoint (sesuai API_SPEC)
- Auth & guard (sesuai USER_ROLE_MATRIX)
- Validation & error handling
- Unit test

## Aturan:
- Urutkan berdasarkan dependency (blocker duluan)
- Pisahkan per module/epic
- Estimasi dalam satuan jam/hari
- Tandai task yang bisa dikerjakan paralel
- Kalau ada ambiguitas, tanyakan sebelum breakdown
- **High (P1):** 35 tasks - Core features
- **Medium (P2):** 25 tasks - Important but can defer
- **Low (P3):** 12 tasks - Nice to have

### Phase Breakdown
- **Phase 1: Foundation** (7 days) - Setup & Core System
- **Phase 2: Core Features** (15 days) - Patient, Queue, Encounter, Clinical
- **Phase 3: Business Logic** (12 days) - Pharmacy, Billing, Reports
- **Phase 4: Integration & Polish** (8 days) - SATUSEHAT, Testing
- **Phase 5: Documentation & Deployment** (3 days) - Final prep

---

## PHASE 1: FOUNDATION & INFRASTRUCTURE (7 days)

### 1.1 PROJECT SETUP

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 1.1 | Initialize NestJS project with TypeScript | 2 jam | P0 | - | ✅ | ✅ Done |
| 1.2 | Setup folder structure (modules, entities, dtos, enums) | 2 jam | P0 | 1.1 | ✅ | ✅ Done |
| 1.3 | Configure TypeORM with MySQL connection | 3 jam | P0 | 1.1 | ✅ | ✅ Done |
| 1.4 | Setup environment variables (.env, config module) | 2 jam | P0 | 1.1 | ✅ | ✅ Done |
| 1.5 | Configure global pipes (ValidationPipe, TransformPipe) | 2 jam | P0 | 1.1 | ✅ | ✅ Done |
| 1.6 | Setup global exception filters | 3 jam | P0 | 1.1 | ✅ | ✅ Done |
| 1.7 | Configure logging (Winston or Pino) | 2 jam | P1 | 1.1 | ✅ | ⬜ To Do |
| 1.8 | Setup Swagger/OpenAPI documentation | 2 jam | P1 | 1.1 | ✅ | ✅ Done |
| 1.9 | Configure CORS for Flutter frontend | 1 jam | P0 | 1.1 | ✅ | ✅ Done |

**Subtotal Phase 1.1:** 19 jam (~2.5 hari)

---

### 1.2 DATABASE SETUP

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 1.10 | Run DDL SQL script (create all tables) | 1 jam | P0 | 1.3 | ❌ | ⬜ To Do |
| 1.11 | Create TypeORM entities (all 26 entities) | 8 jam | P0 | 1.10 | ✅ | ✅ Done |
| 1.12 | Create enums (UserRole, SyncStatus, EncounterStatus, etc.) | 2 jam | P0 | 1.11 | ✅ | ✅ Done |
| 1.13 | Create base entity (BaseEntity with audit fields) | 1 jam | P0 | 1.11 | ✅ | ✅ Done |
| 1.14 | Verify entity relations with TypeORM | 2 jam | P0 | 1.11 | ❌ | ⬜ To Do |
| 1.15 | Create initial seed data (owner code, sample clinic) | 2 jam | P1 | 1.10 | ✅ | ⬜ To Do |
| 1.16 | Setup database migration strategy | 2 jam | P1 | 1.3 | ✅ | ⬜ To Do |

**Subtotal Phase 1.2:** 18 jam (~2 hari)

---

### 1.3 COMMON UTILITIES

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 1.17 | Create response wrapper (success/error format) | 2 jam | P0 | 1.6 | ✅ | ⬜ To Do |
| 1.18 | Create custom exception classes (ValidationException, BusinessException, etc.) | 3 jam | P0 | 1.6 | ✅ | ⬜ To Do |
| 1.19 | Create pagination DTO and helper | 2 jam | P1 | - | ✅ | ⬜ To Do |
| 1.20 | Create date utility functions (timezone handling) | 2 jam | P1 | - | ✅ | ⬜ To Do |
| 1.21 | Create NIK validator (16 digits, numeric) | 1 jam | P1 | - | ✅ | ⬜ To Do |
| 1.22 | Create password hash utility (bcrypt) | 1 jam | P0 | - | ✅ | ⬜ To Do |

**Subtotal Phase 1.3:** 11 jam (~1.5 hari)

**🎯 Phase 1 Total:** 48 jam (6 hari)

---

## PHASE 2: CORE SYSTEM (8 days)

### 2.1 AUTHENTICATION MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 2.1 | Create Auth module structure | 1 jam | P0 | 1.11 | ❌ | ✅ Done |
| 2.2 | Create DTOs (RegisterDto, LoginDto) | 2 jam | P0 | 2.1 | ✅ | ✅ Done |
| 2.3 | Implement POST /auth/register endpoint | 4 jam | P0 | 2.2 | ❌ | ✅ Done |
| 2.4 | Implement owner code validation logic | 2 jam | P0 | 2.3 | ❌ | ✅ Done |
| 2.5 | Implement POST /auth/login endpoint | 3 jam | P0 | 2.3 | ❌ | ✅ Done |
| 2.6 | Implement JWT token generation | 2 jam | P0 | 2.5 | ❌ | ✅ Done |
| 2.7 | Create JWT strategy & guard | 3 jam | P0 | 2.6 | ❌ | ✅ Done |
| 2.8 | Implement POST /auth/refresh endpoint | 2 jam | P1 | 2.6 | ✅ | ⬜ To Do |
| 2.9 | Implement GET /auth/me endpoint | 1 jam | P0 | 2.7 | ❌ | ✅ Done |
| 2.10 | Implement GET /auth/activation-status (polling) | 1 jam | P0 | 2.7 | ✅ | ⬜ To Do |
| 2.11 | Implement POST /auth/verify-email | 2 jam | P1 | 2.3 | ✅ | ⬜ To Do |
| 2.12 | Implement POST /auth/logout | 1 jam | P1 | 2.7 | ✅ | ⬜ To Do |
| 2.13 | Create email verification service (mock for now) | 2 jam | P2 | 2.3 | ✅ | ⬜ To Do |
| 2.14 | Unit test: Auth service | 4 jam | P1 | 2.12 | ✅ | ⬜ To Do |

**Subtotal Module 2.1:** 30 jam (~4 hari)

---

### 2.2 ROLE-BASED ACCESS CONTROL (RBAC)

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 2.15 | Create RolesGuard (check user role from JWT) | 3 jam | P0 | 2.7 | ❌ | ✅ Done |
| 2.16 | Create @Roles() decorator | 1 jam | P0 | 2.15 | ❌ | ✅ Done |
| 2.17 | Create ClinicContextGuard (filter by clinicId) | 3 jam | P0 | 2.7 | ✅ | ✅ Done |
| 2.18 | Create IsActiveGuard (check user.isActive) | 2 jam | P0 | 2.7 | ✅ | ✅ Done |
| 2.19 | Create @CurrentUser() decorator | 1 jam | P0 | 2.7 | ✅ | ✅ Done |
| 2.20 | Unit test: Guards & decorators | 3 jam | P1 | 2.18 | ✅ | ⬜ To Do |

**Subtotal Module 2.2:** 13 jam (~1.5 hari)

---

### 2.3 USER MANAGEMENT MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 2.21 | Create Users module structure | 1 jam | P0 | 1.11 | ✅ | ✅ Done |
| 2.22 | Create User DTOs (CreateUserDto, UpdateUserDto, UserResponseDto) | 2 jam | P0 | 2.21 | ✅ | ✅ Done |
| 2.23 | Implement GET /users (list users by clinic) | 3 jam | P0 | 2.22 | ❌ | ✅ Done |
| 2.24 | Implement POST /users/:id/activate | 4 jam | P0 | 2.23 | ❌ | ✅ Done |
| 2.25 | Implement POST /users/:id/deactivate | 2 jam | P1 | 2.24 | ✅ | ✅ Done |
| 2.26 | Implement DELETE /users/:id (reject pending) | 2 jam | P1 | 2.23 | ✅ | ✅ Done |
| 2.27 | Add role guard: only Owner can access | 1 jam | P0 | 2.15, 2.23 | ❌ | ✅ Done |
| 2.28 | Unit test: Users service | 3 jam | P1 | 2.26 | ✅ | ⬜ To Do |

**Subtotal Module 2.3:** 18 jam (~2 hari)

---

### 2.4 CLINIC MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 2.29 | Create Clinics module structure | 1 jam | P0 | 1.11 | ✅ | ✅ Done |
| 2.30 | Create Clinic DTOs | 2 jam | P0 | 2.29 | ✅ | ✅ Done |
| 2.31 | Implement GET /settings/clinic | 2 jam | P0 | 2.30 | ❌ | ✅ Done |
| 2.32 | Implement PUT /settings/clinic | 3 jam | P0 | 2.31 | ❌ | ✅ Done |
| 2.33 | Implement POST /settings/satusehat (config) | 2 jam | P1 | 2.32 | ✅ | ✅ Done |
| 2.34 | Implement POST /settings/satusehat/test (test connection) | 2 jam | P1 | 2.33 | ✅ | ✅ Done |
| 2.35 | Add encryption for satusehat_client_secret | 2 jam | P1 | 2.33 | ✅ | ⬜ To Do |
| 2.36 | Unit test: Clinics service | 2 jam | P1 | 2.34 | ✅ | ⬜ To Do |

**Subtotal Module 2.4:** 16 jam (~2 hari)

---

### 2.5 PRACTITIONER MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 2.37 | Create Practitioners module structure | 1 jam | P0 | 1.11 | ✅ | ✅ Done |
| 2.38 | Create Practitioner DTOs | 2 jam | P0 | 2.37 | ✅ | ✅ Done |
| 2.39 | Implement GET /settings/practitioners | 2 jam | P0 | 2.38 | ❌ | ✅ Done |
| 2.40 | Implement POST /settings/practitioners/search-satusehat | 3 jam | P1 | 2.39 | ✅ | ✅ Done |
| 2.41 | Implement POST /settings/practitioners (register) | 3 jam | P0 | 2.40 | ❌ | ✅ Done |
| 2.42 | Implement PUT /settings/practitioners/:id | 2 jam | P1 | 2.41 | ✅ | ✅ Done |
| 2.43 | Unit test: Practitioners service | 2 jam | P1 | 2.42 | ✅ | ⬜ To Do |

**Subtotal Module 2.5:** 15 jam (~2 hari)

---

### 2.6 LOCATION MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 2.44 | Create Locations module structure | 1 jam | P0 | 1.11 | ✅ | ✅ Done |
| 2.45 | Create Location DTOs | 1 jam | P0 | 2.44 | ✅ | ✅ Done |
| 2.46 | Implement GET /settings/locations | 2 jam | P0 | 2.45 | ❌ | ✅ Done |
| 2.47 | Implement POST /settings/locations | 2 jam | P1 | 2.46 | ✅ | ✅ Done |
| 2.48 | Implement PUT /settings/locations/:id | 1 jam | P1 | 2.47 | ✅ | ✅ Done |
| 2.49 | Unit test: Locations service | 2 jam | P2 | 2.48 | ✅ | ⬜ To Do |

**Subtotal Module 2.6:** 9 jam (~1 hari)

**🎯 Phase 2 Total:** 101 jam (~13 hari)

---

## PHASE 3: PATIENT & QUEUE MANAGEMENT (7 days)

### 3.1 PATIENT MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 3.1 | Create Patients module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 3.2 | Create Patient DTOs (CreatePatientDto, UpdatePatientDto, etc.) | 3 jam | P0 | 3.1 | ✅ | ⬜ To Do |
| 3.3 | Implement GET /patients (list with pagination) | 3 jam | P0 | 3.2 | ❌ | ⬜ To Do |
| 3.4 | Implement search by NIK, name, noRM | 2 jam | P0 | 3.3 | ❌ | ⬜ To Do |
| 3.5 | Implement POST /patients (register new patient) | 5 jam | P0 | 3.2 | ❌ | ⬜ To Do |
| 3.6 | Implement No. RM generation (transaction-safe) | 3 jam | P0 | 3.5 | ❌ | ⬜ To Do |
| 3.7 | Implement newborn registration (without NIK) | 2 jam | P0 | 3.5 | ✅ | ⬜ To Do |
| 3.8 | Implement GET /patients/:id (detail) | 2 jam | P0 | 3.3 | ✅ | ⬜ To Do |
| 3.9 | Implement PUT /patients/:id (update demographics) | 3 jam | P0 | 3.8 | ❌ | ⬜ To Do |
| 3.10 | Implement GET /patients/:id/encounters (history) | 2 jam | P1 | 3.8 | ✅ | ⬜ To Do |
| 3.11 | Implement GET /patients/search-satusehat (NIK lookup) | 3 jam | P1 | 3.2 | ✅ | ⬜ To Do |
| 3.12 | Add duplicate NIK check | 1 jam | P0 | 3.5 | ❌ | ⬜ To Do |
| 3.13 | Unit test: Patients service | 4 jam | P1 | 3.11 | ✅ | ⬜ To Do |

**Subtotal Module 3.1:** 34 jam (~4 hari)

---

### 3.2 QUEUE MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 3.14 | Create Queues module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 3.15 | Create Queue DTOs | 3 jam | P0 | 3.14 | ✅ | ⬜ To Do |
| 3.16 | Implement GET /queues (admin view with filters) | 3 jam | P0 | 3.15 | ❌ | ⬜ To Do |
| 3.17 | Implement POST /queues (walk-in) | 4 jam | P0 | 3.15 | ❌ | ⬜ To Do |
| 3.18 | Implement queue number generation (reset daily) | 2 jam | P0 | 3.17 | ❌ | ⬜ To Do |
| 3.19 | Implement PATCH /queues/:id/status (update status) | 3 jam | P0 | 3.17 | ❌ | ⬜ To Do |
| 3.20 | Implement status transition validation | 2 jam | P0 | 3.19 | ❌ | ⬜ To Do |
| 3.21 | Implement GET /queues/slots (available time slots) | 3 jam | P0 | 3.15 | ✅ | ⬜ To Do |
| 3.22 | Implement GET /queues/monitor (waiting room display) | 2 jam | P1 | 3.16 | ✅ | ⬜ To Do |
| 3.23 | Unit test: Queues service | 4 jam | P1 | 3.22 | ✅ | ⬜ To Do |

**Subtotal Module 3.2:** 27 jam (~3.5 hari)

---

### 3.3 PUBLIC QUEUE ENDPOINTS (No Auth)

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 3.24 | Create Public module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 3.25 | Implement GET /public/clinic-info | 2 jam | P1 | 3.24 | ✅ | ⬜ To Do |
| 3.26 | Implement GET /public/available-slots | 2 jam | P0 | 3.21 | ❌ | ⬜ To Do |
| 3.27 | Implement POST /public/book (online booking) | 4 jam | P0 | 3.17 | ❌ | ⬜ To Do |
| 3.28 | Implement token generation (8-char alphanumeric) | 1 jam | P0 | 3.27 | ❌ | ⬜ To Do |
| 3.29 | Implement GET /public/queue-status (check by token) | 2 jam | P0 | 3.27 | ✅ | ⬜ To Do |
| 3.30 | Add rate limiting for public endpoints | 2 jam | P1 | 3.29 | ✅ | ⬜ To Do |
| 3.31 | Unit test: Public endpoints | 3 jam | P1 | 3.30 | ✅ | ⬜ To Do |

**Subtotal Module 3.3:** 17 jam (~2 hari)

**🎯 Phase 3 Total:** 78 jam (~10 hari)

---

## PHASE 4: CLINICAL DOCUMENTATION (10 days)

### 4.1 ENCOUNTER MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 4.1 | Create Encounters module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 4.2 | Create Encounter DTOs | 3 jam | P0 | 4.1 | ✅ | ⬜ To Do |
| 4.3 | Implement GET /encounters (list with filters) | 3 jam | P0 | 4.2 | ❌ | ⬜ To Do |
| 4.4 | Implement POST /encounters (create from queue) | 4 jam | P0 | 4.2 | ❌ | ⬜ To Do |
| 4.5 | Implement GET /encounters/:id (detail) | 2 jam | P0 | 4.3 | ✅ | ⬜ To Do |
| 4.6 | Implement PATCH /encounters/:id/status | 4 ham | P0 | 4.4 | ❌ | ⬜ To Do |
| 4.7 | Implement validation: finished requires clinical data | 3 jam | P0 | 4.6 | ❌ | ⬜ To Do |
| 4.8 | Implement role-based filtering (dokter sees only own) | 2 jam | P0 | 4.3 | ❌ | ⬜ To Do |
| 4.9 | Unit test: Encounters service | 4 jam | P1 | 4.8 | ✅ | ⬜ To Do |

**Subtotal Module 4.1:** 26 jam (~3 hari)

---

### 4.2 ANAMNESIS MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 4.10 | Create Anamnesis module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 4.11 | Create Anamnesis DTOs | 2 jam | P0 | 4.10 | ✅ | ⬜ To Do |
| 4.12 | Implement GET /encounters/:id/anamnesis | 2 jam | P0 | 4.11 | ❌ | ⬜ To Do |
| 4.13 | Implement PUT /encounters/:id/anamnesis (upsert) | 3 jam | P0 | 4.12 | ❌ | ⬜ To Do |
| 4.14 | Create Allergies sub-resource (nested in anamnesis) | 2 jam | P0 | 4.13 | ✅ | ⬜ To Do |
| 4.15 | Create Medication History sub-resource | 2 jam | P0 | 4.13 | ✅ | ⬜ To Do |
| 4.16 | Unit test: Anamnesis service | 2 jam | P1 | 4.15 | ✅ | ⬜ To Do |

**Subtotal Module 4.2:** 14 jam (~2 hari)

---

### 4.3 VITAL SIGNS MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 4.17 | Create VitalSigns module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 4.18 | Create VitalSigns DTOs with LOINC codes | 2 jam | P0 | 4.17 | ✅ | ⬜ To Do |
| 4.19 | Implement GET /encounters/:id/vital-signs | 2 jam | P0 | 4.18 | ❌ | ⬜ To Do |
| 4.20 | Implement PUT /encounters/:id/vital-signs | 3 jam | P0 | 4.19 | ❌ | ⬜ To Do |
| 4.21 | Implement validation ranges & out-of-range detection | 2 jam | P0 | 4.20 | ❌ | ⬜ To Do |
| 4.22 | Unit test: VitalSigns service | 2 jam | P1 | 4.21 | ✅ | ⬜ To Do |

**Subtotal Module 4.3:** 12 jam (~1.5 hari)

---

### 4.4 DIAGNOSIS MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 4.23 | Create Diagnoses module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 4.24 | Create Diagnosis DTOs | 2 jam | P0 | 4.23 | ✅ | ⬜ To Do |
| 4.25 | Implement GET /encounters/:id/diagnoses | 2 jam | P0 | 4.24 | ❌ | ⬜ To Do |
| 4.26 | Implement POST /encounters/:id/diagnoses | 3 jam | P0 | 4.25 | ❌ | ⬜ To Do |
| 4.27 | Implement isPrimary logic (only 1 per encounter) | 2 jam | P0 | 4.26 | ❌ | ⬜ To Do |
| 4.28 | Implement DELETE /encounters/:id/diagnoses/:diagnosisId | 1 jam | P1 | 4.26 | ✅ | ⬜ To Do |
| 4.29 | Implement GET /icd10/search (search ICD-10 codes) | 3 jam | P0 | 4.24 | ✅ | ⬜ To Do |
| 4.30 | Load ICD-10 JSON data into memory/cache | 2 jam | P0 | 4.29 | ❌ | ⬜ To Do |
| 4.31 | Unit test: Diagnoses service | 3 jam | P1 | 4.30 | ✅ | ⬜ To Do |

**Subtotal Module 4.4:** 19 jam (~2.5 hari)

---

### 4.5 PROCEDURE MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 4.32 | Create Procedures module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 4.33 | Create Procedure DTOs | 2 jam | P0 | 4.32 | ✅ | ⬜ To Do |
| 4.34 | Implement GET /encounters/:id/procedures | 2 jam | P0 | 4.33 | ❌ | ⬜ To Do |
| 4.35 | Implement POST /encounters/:id/procedures | 3 jam | P0 | 4.34 | ❌ | ⬜ To Do |
| 4.36 | Implement tooth number validation (FDI notation) | 1 jam | P0 | 4.35 | ❌ | ⬜ To Do |
| 4.37 | Implement DELETE /encounters/:id/procedures/:id | 1 jam | P1 | 4.35 | ✅ | ⬜ To Do |
| 4.38 | Implement GET /icd9/search (search ICD-9 codes) | 3 jam | P0 | 4.33 | ✅ | ⬜ To Do |
| 4.39 | Load ICD-9 JSON data into memory/cache | 2 jam | P0 | 4.38 | ❌ | ⬜ To Do |
| 4.40 | Unit test: Procedures service | 3 jam | P1 | 4.39 | ✅ | ⬜ To Do |

**Subtotal Module 4.5:** 18 jam (~2 hari)

---

### 4.6 ODONTOGRAM MODULE (Dental-specific)

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 4.41 | Create Odontogram module structure | 1 jam | P1 | 1.11 | ✅ | ⬜ To Do |
| 4.42 | Create Odontogram DTOs (complex JSON structure) | 3 jam | P1 | 4.41 | ✅ | ⬜ To Do |
| 4.43 | Implement GET /encounters/:id/odontogram | 2 jam | P1 | 4.42 | ❌ | ⬜ To Do |
| 4.44 | Implement PUT /encounters/:id/odontogram | 3 jam | P1 | 4.43 | ❌ | ⬜ To Do |
| 4.45 | Implement DMF-T calculation logic | 2 jam | P1 | 4.44 | ❌ | ⬜ To Do |
| 4.46 | Unit test: Odontogram service | 2 jam | P2 | 4.45 | ✅ | ⬜ To Do |

**Subtotal Module 4.6:** 13 jam (~2 hari)

---

### 4.7 OHIS MODULE (Oral Hygiene Index)

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 4.47 | Create OHIS module structure | 1 jam | P1 | 1.11 | ✅ | ⬜ To Do |
| 4.48 | Create OHIS DTOs | 2 jam | P1 | 4.47 | ✅ | ⬜ To Do |
| 4.49 | Implement GET /encounters/:id/ohis | 2 jam | P1 | 4.48 | ❌ | ⬜ To Do |
| 4.50 | Implement PUT /encounters/:id/ohis | 2 jam | P1 | 4.49 | ❌ | ⬜ To Do |
| 4.51 | Implement OHI-S calculation (DI-S, CI-S, interpretation) | 2 jam | P1 | 4.50 | ❌ | ⬜ To Do |
| 4.52 | Unit test: OHIS service | 2 jam | P2 | 4.51 | ✅ | ⬜ To Do |

**Subtotal Module 4.7:** 11 jam (~1.5 hari)

**🎯 Phase 4 Total:** 113 jam (~14 hari)

---

## PHASE 5: PHARMACY MANAGEMENT (5 days)

### 5.1 MEDICATION MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 5.1 | Create Medications module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 5.2 | Create Medication DTOs | 2 jam | P0 | 5.1 | ✅ | ⬜ To Do |
| 5.3 | Implement GET /medications (with filters) | 3 jam | P0 | 5.2 | ❌ | ⬜ To Do |
| 5.4 | Implement POST /medications | 3 jam | P0 | 5.2 | ❌ | ⬜ To Do |
| 5.5 | Implement PUT /medications/:id | 2 jam | P1 | 5.4 | ✅ | ⬜ To Do |
| 5.6 | Implement PATCH /medications/:id/stock (adjust stock) | 3 jam | P0 | 5.4 | ❌ | ⬜ To Do |
| 5.7 | Implement low stock & near expiry filters | 2 jam | P1 | 5.3 | ✅ | ⬜ To Do |
| 5.8 | Unit test: Medications service | 3 jam | P1 | 5.7 | ✅ | ⬜ To Do |

**Subtotal Module 5.1:** 19 jam (~2.5 hari)

---

### 5.2 PRESCRIPTION MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 5.9 | Create Prescriptions module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 5.10 | Create Prescription DTOs | 2 jam | P0 | 5.9 | ✅ | ⬜ To Do |
| 5.11 | Implement GET /encounters/:id/prescriptions | 2 jam | P0 | 5.10 | ❌ | ⬜ To Do |
| 5.12 | Implement POST /encounters/:id/prescriptions | 3 jam | P0 | 5.11 | ❌ | ⬜ To Do |
| 5.13 | Implement duplicate medication check | 1 jam | P0 | 5.12 | ❌ | ⬜ To Do |
| 5.14 | Implement DELETE /encounters/:id/prescriptions/:id | 1 jam | P1 | 5.12 | ✅ | ⬜ To Do |
| 5.15 | Unit test: Prescriptions service | 2 jam | P1 | 5.14 | ✅ | ⬜ To Do |

**Subtotal Module 5.2:** 12 jam (~1.5 hari)

---

### 5.3 DISPENSE MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 5.16 | Create Dispenses module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 5.17 | Create Dispense DTOs | 2 jam | P0 | 5.16 | ✅ | ⬜ To Do |
| 5.18 | Implement POST /encounters/:id/dispense | 4 jam | P0 | 5.17 | ❌ | ⬜ To Do |
| 5.19 | Implement stock deduction logic (transaction) | 3 jam | P0 | 5.18 | ❌ | ⬜ To Do |
| 5.20 | Implement stock validation (prevent negative) | 2 jam | P0 | 5.19 | ❌ | ⬜ To Do |
| 5.21 | Update prescription status to "dispensed" | 1 jam | P0 | 5.18 | ❌ | ⬜ To Do |
| 5.22 | Create medication stock log entry | 2 jam | P0 | 5.19 | ❌ | ⬜ To Do |
| 5.23 | Unit test: Dispenses service | 3 jam | P1 | 5.22 | ✅ | ⬜ To Do |

**Subtotal Module 5.3:** 18 jam (~2 hari)

**🎯 Phase 5 Total:** 49 jam (~6 hari)

---

## PHASE 6: BILLING & PAYMENT (5 days)

### 6.1 TARIF MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 6.1 | Create Tarifs module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 6.2 | Create Tarif DTOs | 2 jam | P0 | 6.1 | ✅ | ⬜ To Do |
| 6.3 | Implement GET /settings/tarifs | 2 jam | P0 | 6.2 | ❌ | ⬜ To Do |
| 6.4 | Implement POST /settings/tarifs | 2 jam | P0 | 6.3 | ❌ | ⬜ To Do |
| 6.5 | Implement PUT /settings/tarifs/:id | 2 jam | P1 | 6.4 | ✅ | ⬜ To Do |
| 6.6 | Unit test: Tarifs service | 2 jam | P1 | 6.5 | ✅ | ⬜ To Do |

**Subtotal Module 6.1:** 11 jam (~1.5 hari)

---

### 6.2 BILLING MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 6.7 | Create Billings module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 6.8 | Create Billing DTOs (nested with items) | 3 jam | P0 | 6.7 | ✅ | ⬜ To Do |
| 6.9 | Implement GET /billings (list with filters) | 3 jam | P0 | 6.8 | ❌ | ⬜ To Do |
| 6.10 | Implement POST /billings | 5 jam | P0 | 6.8 | ❌ | ⬜ To Do |
| 6.11 | Implement invoice number generation (INV-YYYY-XXXXX) | 2 jam | P0 | 6.10 | ❌ | ⬜ To Do |
| 6.12 | Implement discount validation (max diskon) | 2 jam | P0 | 6.10 | ❌ | ⬜ To Do |
| 6.13 | Implement subtotal & grand total calculation | 2 jam | P0 | 6.10 | ❌ | ⬜ To Do |
| 6.14 | Implement GET /billings/:id (detail with items) | 2 jam | P0 | 6.9 | ✅ | ⬜ To Do |
| 6.15 | Unit test: Billings service | 4 ham | P1 | 6.14 | ✅ | ⬜ To Do |

**Subtotal Module 6.2:** 24 jam (~3 hari)

---

### 6.3 PAYMENT MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 6.16 | Create Payments module structure | 1 jam | P0 | 1.11 | ✅ | ⬜ To Do |
| 6.17 | Create Payment DTOs | 2 jam | P0 | 6.16 | ✅ | ⬜ To Do |
| 6.18 | Implement POST /billings/:id/payments | 4 jam | P0 | 6.17 | ❌ | ⬜ To Do |
| 6.19 | Implement receipt number generation (RCP-YYYY-XXXXX) | 1 jam | P0 | 6.18 | ❌ | ⬜ To Do |
| 6.20 | Update billing status (unpaid/partial/paid) | 2 jam | P0 | 6.18 | ❌ | ⬜ To Do |
| 6.21 | Unit test: Payments service | 2 jam | P1 | 6.20 | ✅ | ⬜ To Do |

**Subtotal Module 6.3:** 12 jam (~1.5 hari)

---

### 6.4 REFUND REQUEST MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 6.22 | Create RefundRequests module structure | 1 jam | P2 | 1.11 | ✅ | ⬜ To Do |
| 6.23 | Create RefundRequest DTOs | 2 jam | P2 | 6.22 | ✅ | ⬜ To Do |
| 6.24 | Implement POST /billings/:id/refund-request | 3 jam | P2 | 6.23 | ✅ | ⬜ To Do |
| 6.25 | Implement POST /billings/:id/refund-request/:id/approve | 3 jam | P2 | 6.24 | ✅ | ⬜ To Do |
| 6.26 | Unit test: RefundRequests service | 2 jam | P2 | 6.25 | ✅ | ⬜ To Do |

**Subtotal Module 6.4:** 11 jam (~1.5 hari)

---

### 6.5 INVOICE GENERATION (Optional)

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 6.27 | Install PDF generation library (puppeteer or pdfmake) | 1 jam | P2 | - | ✅ | ⬜ To Do |
| 6.28 | Create invoice HTML template | 2 jam | P2 | 6.27 | ✅ | ⬜ To Do |
| 6.29 | Implement GET /billings/:id/invoice (PDF download) | 3 jam | P2 | 6.28 | ✅ | ⬜ To Do |

**Subtotal Module 6.5:** 6 jam (~1 hari)

**🎯 Phase 6 Total:** 64 jam (~8 hari)

---

## PHASE 7: REPORTING (3 days)

### 7.1 VISIT REPORTS

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 7.1 | Create Reports module structure | 1 jam | P1 | 1.11 | ✅ | ⬜ To Do |
| 7.2 | Create Report DTOs | 2 jam | P1 | 7.1 | ✅ | ⬜ To Do |
| 7.3 | Implement GET /reports/visits | 4 jam | P1 | 7.2 | ❌ | ⬜ To Do |
| 7.4 | Implement summary aggregation (total, by day, by doctor) | 3 jam | P1 | 7.3 | ❌ | ⬜ To Do |
| 7.5 | Implement role-based filtering (dokter sees own only) | 2 jam | P1 | 7.3 | ❌ | ⬜ To Do |
| 7.6 | Unit test: Visit reports | 2 jam | P2 | 7.5 | ✅ | ⬜ To Do |

**Subtotal Module 7.1:** 14 jam (~2 hari)

---

### 7.2 FINANCIAL REPORTS

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 7.7 | Implement GET /reports/financial | 4 jam | P1 | 7.2 | ✅ | ⬜ To Do |
| 7.8 | Implement summary (revenue, paid, outstanding, collection rate) | 3 jam | P1 | 7.7 | ❌ | ⬜ To Do |
| 7.9 | Implement breakdown (by day, payment method, doctor) | 3 jam | P1 | 7.7 | ❌ | ⬜ To Do |
| 7.10 | Add Owner-only guard | 1 jam | P1 | 7.7 | ❌ | ⬜ To Do |
| 7.11 | Unit test: Financial reports | 2 jam | P2 | 7.10 | ✅ | ⬜ To Do |

**Subtotal Module 7.2:** 13 jam (~1.5 hari)

---

### 7.3 SATUSEHAT SYNC REPORTS

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 7.12 | Implement GET /reports/satusehat-sync | 3 jam | P1 | 7.2 | ✅ | ⬜ To Do |
| 7.13 | Implement summary (total, synced, failed, pending) | 2 jam | P1 | 7.12 | ❌ | ⬜ To Do |
| 7.14 | Implement failed items list | 2 jam | P1 | 7.12 | ❌ | ⬜ To Do |
| 7.15 | Implement POST /reports/satusehat-sync/retry | 2 jam | P1 | 7.14 | ✅ | ⬜ To Do |
| 7.16 | Unit test: SATUSEHAT reports | 2 jam | P2 | 7.15 | ✅ | ⬜ To Do |

**Subtotal Module 7.3:** 11 jam (~1.5 hari)

**🎯 Phase 7 Total:** 38 jam (~5 hari)

---

## PHASE 8: SATUSEHAT INTEGRATION (6 days)

### 8.1 SATUSEHAT CLIENT SETUP

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 8.1 | Create SatusehatClient service (HTTP client) | 3 jam | P0 | - | ✅ | ⬜ To Do |
| 8.2 | Implement OAuth2 token management | 4 jam | P0 | 8.1 | ❌ | ⬜ To Do |
| 8.3 | Implement token refresh logic (expires < 30min) | 2 jam | P0 | 8.2 | ❌ | ⬜ To Do |
| 8.4 | Create FHIR R4 mapping utilities | 4 jam | P0 | 8.1 | ✅ | ⬜ To Do |
| 8.5 | Implement error handling for SATUSEHAT API | 2 jam | P0 | 8.1 | ✅ | ⬜ To Do |
| 8.6 | Unit test: SatusehatClient | 3 jam | P1 | 8.5 | ✅ | ⬜ To Do |

**Subtotal Module 8.1:** 18 jam (~2 hari)

---

### 8.2 SATUSEHAT SYNC SERVICES

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 8.7 | Create Patient sync service (map to FHIR Patient) | 4 jam | P0 | 8.4 | ✅ | ⬜ To Do |
| 8.8 | Create Encounter sync service (map to FHIR Encounter) | 4 jam | P0 | 8.4 | ✅ | ⬜ To Do |
| 8.9 | Create Condition sync service (map to FHIR Condition) | 3 jam | P1 | 8.4 | ✅ | ⬜ To Do |
| 8.10 | Create Procedure sync service (map to FHIR Procedure) | 3 jam | P1 | 8.4 | ✅ | ⬜ To Do |
| 8.11 | Create Observation sync service (vital signs, OHI-S) | 4 jam | P1 | 8.4 | ✅ | ⬜ To Do |
| 8.12 | Create MedicationRequest sync service | 3 jam | P1 | 8.4 | ✅ | ⬜ To Do |
| 8.13 | Create AllergyIntolerance sync service | 2 jam | P2 | 8.4 | ✅ | ⬜ To Do |
| 8.14 | Unit test: All sync services | 6 jam | P1 | 8.13 | ✅ | ⬜ To Do |

**Subtotal Module 8.2:** 29 jam (~4 hari)

---

### 8.3 SYNC ORCHESTRATION

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 8.15 | Create sync orchestrator (trigger sync on encounter finish) | 3 jam | P0 | 8.8 | ❌ | ⬜ To Do |
| 8.16 | Implement sync queue (retry failed syncs) | 4 jam | P1 | 8.15 | ✅ | ⬜ To Do |
| 8.17 | Create satusehat_sync_logs table entries | 2 jam | P0 | 8.15 | ❌ | ⬜ To Do |
| 8.18 | Implement manual sync endpoint POST /satusehat/sync/:type/:id | 2 jam | P1 | 8.15 | ✅ | ⬜ To Do |
| 8.19 | Implement retry logic (exponential backoff) | 3 jam | P1 | 8.16 | ✅ | ⬜ To Do |
| 8.20 | Unit test: Sync orchestration | 3 jam | P1 | 8.19 | ✅ | ⬜ To Do |

**Subtotal Module 8.3:** 17 jam (~2 hari)

**🎯 Phase 8 Total:** 64 jam (~8 hari)

---

## PHASE 9: SOAP TEMPLATES & SETTINGS (2 days)

### 9.1 SOAP TEMPLATE MODULE

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 9.1 | Create SoapTemplates module structure | 1 jam | P2 | 1.11 | ✅ | ⬜ To Do |
| 9.2 | Create SoapTemplate DTOs | 2 jam | P2 | 9.1 | ✅ | ⬜ To Do |
| 9.3 | Implement GET /settings/soap-templates | 2 jam | P2 | 9.2 | ✅ | ⬜ To Do |
| 9.4 | Implement POST /settings/soap-templates | 2 jam | P2 | 9.3 | ✅ | ⬜ To Do |
| 9.5 | Implement shared vs personal logic | 2 jam | P2 | 9.4 | ✅ | ⬜ To Do |
| 9.6 | Unit test: SoapTemplates service | 2 jam | P2 | 9.5 | ✅ | ⬜ To Do |

**Subtotal Module 9.1:** 11 jam (~1.5 hari)

**🎯 Phase 9 Total:** 11 jam (~1.5 hari)

---

## PHASE 10: TESTING & QUALITY ASSURANCE (5 days)

### 10.1 UNIT TESTING (Additional Coverage)

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 10.1 | Increase unit test coverage to >80% | 16 jam | P1 | All modules | ✅ | ⬜ To Do |
| 10.2 | Create test utilities & mocks | 4 jam | P1 | - | ✅ | ⬜ To Do |

**Subtotal 10.1:** 20 jam (~2.5 hari)

---

### 10.2 INTEGRATION TESTING

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 10.3 | Setup E2E testing environment (test DB) | 2 jam | P1 | 1.3 | ✅ | ⬜ To Do |
| 10.4 | E2E test: Auth flow (register → login → activate) | 3 jam | P1 | 10.3 | ❌ | ⬜ To Do |
| 10.5 | E2E test: Patient registration → encounter → billing | 4 jam | P1 | 10.3 | ❌ | ⬜ To Do |
| 10.6 | E2E test: Queue booking → call → encounter | 3 jam | P1 | 10.3 | ❌ | ⬜ To Do |
| 10.7 | E2E test: Clinical documentation workflow | 3 jam | P1 | 10.3 | ❌ | ⬜ To Do |

**Subtotal 10.2:** 15 jam (~2 hari)

---

### 10.3 PERFORMANCE & SECURITY

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 10.8 | Add rate limiting (global & per endpoint) | 2 jam | P1 | - | ✅ | ⬜ To Do |
| 10.9 | Add helmet.js for security headers | 1 jam | P1 | - | ✅ | ⬜ To Do |
| 10.10 | Implement SQL injection prevention (parameterized queries) | 1 jam | P0 | 1.3 | ✅ | ⬜ To Do |
| 10.11 | Add request/response logging middleware | 2 jam | P1 | 1.7 | ✅ | ⬜ To Do |
| 10.12 | Performance testing (load test key endpoints) | 4 jam | P2 | All modules | ✅ | ⬜ To Do |

**Subtotal 10.3:** 10 jam (~1.5 hari)

**🎯 Phase 10 Total:** 45 jam (~6 hari)

---

## PHASE 11: DOCUMENTATION & DEPLOYMENT (3 days)

### 11.1 DOCUMENTATION

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 11.1 | Complete Swagger/OpenAPI documentation | 4 jam | P1 | All endpoints | ✅ | ⬜ To Do |
| 11.2 | Write README.md (setup, env vars, run instructions) | 2 jam | P1 | - | ✅ | ⬜ To Do |
| 11.3 | Create API postman collection | 2 jam | P2 | All endpoints | ✅ | ⬜ To Do |
| 11.4 | Write deployment guide (Docker, PM2, nginx) | 2 jam | P1 | - | ✅ | ⬜ To Do |

**Subtotal 11.1:** 10 jam (~1.5 hari)

---

### 11.2 DEPLOYMENT PREP

| No | Task | Estimasi | Priority | Dependencies | Parallel? | Status |
|----|------|----------|----------|--------------|-----------|--------|
| 11.5 | Create Dockerfile | 2 jam | P1 | - | ✅ | ⬜ To Do |
| 11.6 | Create docker-compose.yml (app + MySQL) | 2 jam | P1 | 11.5 | ✅ | ⬜ To Do |
| 11.7 | Setup environment config for prod/staging/dev | 2 jam | P1 | 1.4 | ✅ | ⬜ To Do |
| 11.8 | Create PM2 ecosystem file | 1 jam | P1 | - | ✅ | ⬜ To Do |
| 11.9 | Setup database backup strategy | 2 jam | P1 | - | ✅ | ⬜ To Do |
| 11.10 | Final smoke test on staging | 3 jam | P0 | All modules | ❌ | ⬜ To Do |

**Subtotal 11.2:** 12 jam (~1.5 hari)

**🎯 Phase 11 Total:** 22 jam (~3 hari)

---

## SUMMARY STATISTICS

### Total Time Breakdown

| Phase | Description | Estimated Hours | Estimated Days |
|-------|-------------|-----------------|----------------|
| **Phase 1** | Foundation & Infrastructure | 48 | 6 |
| **Phase 2** | Core System (Auth, User, RBAC, Clinic, Practitioner, Location) | 101 | 13 |
| **Phase 3** | Patient & Queue Management | 78 | 10 |
| **Phase 4** | Clinical Documentation | 113 | 14 |
| **Phase 5** | Pharmacy Management | 49 | 6 |
| **Phase 6** | Billing & Payment | 64 | 8 |
| **Phase 7** | Reporting | 38 | 5 |
| **Phase 8** | SATUSEHAT Integration | 64 | 8 |
| **Phase 9** | SOAP Templates & Settings | 11 | 1.5 |
| **Phase 10** | Testing & QA | 45 | 6 |
| **Phase 11** | Documentation & Deployment | 22 | 3 |
| **TOTAL** | | **633 jam** | **~79 hari** |

**Note:** Estimasi sudah termasuk buffer ~15% untuk debugging dan refactoring.

---

### Priority Distribution

| Priority | Count | Percentage |
|----------|-------|------------|
| **P0 (Critical)** | 65 tasks | 36% |
| **P1 (High)** | 84 tasks | 46% |
| **P2 (Medium)** | 27 tasks | 15% |
| **P3 (Low)** | 6 tasks | 3% |

---

### Parallelization Opportunities

**Phase 1:** After task 1.1-1.10 (setup), most tasks can run in parallel (1.11-1.22)

**Phase 2:** 
- Module 2.1 (Auth) is blocker
- After 2.1, modules 2.3-2.6 can run in parallel

**Phase 3:**
- Module 3.1 (Patient) and 3.2 (Queue) can run in parallel after Phase 2
- Module 3.3 (Public) depends on 3.2

**Phase 4:**
- All clinical modules (4.2-4.7) can run in parallel after 4.1 (Encounter)

**Phase 5-6:**
- Pharmacy and Billing can run in parallel

**Phase 7:**
- All report modules can run in parallel

**Phase 8:**
- Sync services (8.7-8.13) can run in parallel after 8.1-8.4

---

### Recommended Team Allocation

#### **Solo Developer (1 person):**
- Total: ~79 hari kerja (~4 bulan)
- Follow phases sequentially
- Focus on P0 → P1 → P2

#### **2 Developers:**
- **Dev 1:** Phase 1, 2, 3 (Foundation + Patient/Queue) - ~30 hari
- **Dev 2:** Phase 4, 5 (Clinical + Pharmacy) - ~20 hari
- **Both:** Phase 6, 7, 8 (Billing + Reports + Integration) - ~15 hari
- **Total:** ~35-40 hari kalender

#### **3 Developers (Optimal):**
- **Dev 1 (Backend Lead):** Phase 1, 2, 8 (Foundation + Auth + SATUSEHAT)
- **Dev 2 (Clinical):** Phase 3, 4 (Patient + Clinical Documentation)
- **Dev 3 (Finance):** Phase 5, 6, 7 (Pharmacy + Billing + Reports)
- **All:** Phase 10, 11 (Testing + Deployment)
- **Total:** ~25-30 hari kalender

---

## DEPENDENCIES GRAPH (Simplified)

```
Phase 1 (Setup)
    ↓
Phase 2 (Auth & Core)
    ↓
    ├─→ Phase 3 (Patient & Queue)
    │      ↓
    ├─→ Phase 4 (Clinical) ───────┐
    │                              │
    ├─→ Phase 5 (Pharmacy) ────────┤
    │                              │
    ├─→ Phase 6 (Billing) ─────────┤
    │                              ↓
    └─→ Phase 7 (Reports) ───→ Phase 8 (SATUSEHAT)
                                   ↓
                            Phase 10 (Testing)
                                   ↓
                            Phase 11 (Deploy)
```

---

## RISK & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|------------|
| **SATUSEHAT API changes** | High | Keep FHIR mapping in separate service, easy to update |
| **TypeORM performance issues** | Medium | Use QueryBuilder for complex queries, add indexes |
| **Scope creep** | High | Stick to P0-P1 tasks first, defer P2-P3 to v2 |
| **Database migration conflicts** | Medium | Use sequential migration files, test on staging |
| **Token expiry during sync** | Medium | Implement robust token refresh with retry |

---

## NOTES & RECOMMENDATIONS

1. **Start with Phase 1-2:** Foundation is critical, don't skip
2. **Focus on P0 tasks first:** Get MVP working before polish
3. **SATUSEHAT integration can be deferred:** Build local-first, add sync later
4. **Testing is NOT optional:** Allocate time for proper unit + E2E tests
5. **Documentation as you go:** Don't wait until the end
6. **Use feature branches:** 1 branch per module, merge to develop
7. **Daily standup:** Track progress, unblock dependencies
8. **Code review:** Mandatory for critical modules (Auth, Billing, SATUSEHAT)

---

**Last Updated:** 2026-06-11  
**Version:** 1.0  
**Prepared By:** Senior Backend Developer & Tech Lead

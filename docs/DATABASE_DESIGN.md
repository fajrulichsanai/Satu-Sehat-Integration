# DATABASE DESIGN - ApexRecord
## NestJS + MySQL (TypeORM)

**Generated:** 2026-06-11  
**Database Engine:** MySQL 8.0+ with InnoDB  
**Character Set:** utf8mb4  
**Primary Key Strategy:** INT AUTO_INCREMENT

---

## 1. DAFTAR ENTITAS & ATRIBUT

### 1.1 CORE SYSTEM

#### **users**
Menyimpan data user sistem (Owner, Admin, Dokter).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | User ID |
| clinic_id | INT | FK (clinics), NULL | Klinik tempat user bekerja (NULL untuk pending user) |
| practitioner_id | INT | FK (practitioners), NULL | ID practitioner jika role = dokter |
| email | VARCHAR(100) | UNIQUE, NOT NULL | Email login |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hash |
| name | VARCHAR(100) | NOT NULL | Nama lengkap |
| role | ENUM | NOT NULL | owner, admin, dokter, pending |
| is_active | BOOLEAN | DEFAULT FALSE | Status aktif |
| email_verified_at | TIMESTAMP | NULL | Waktu verifikasi email |
| last_login_at | TIMESTAMP | NULL | Login terakhir |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_email` (email)
- KEY `idx_clinic_id` (clinic_id)
- KEY `idx_role_active` (role, is_active)

---

#### **clinics**
Data klinik (multi-tenant by clinic_id).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Clinic ID |
| name | VARCHAR(100) | NOT NULL | Nama klinik |
| address | TEXT | NOT NULL | Alamat lengkap |
| city | VARCHAR(100) | NOT NULL | Kota |
| province | VARCHAR(100) | NOT NULL | Provinsi |
| postal_code | VARCHAR(10) | NULL | Kode pos |
| phone | VARCHAR(20) | NOT NULL | Telepon |
| email | VARCHAR(100) | NULL | Email klinik |
| sip_number | VARCHAR(50) | NULL | Nomor SIP |
| operational_hours | JSON | NULL | Jam operasional per hari (Senin-Minggu) |
| satusehat_org_id | VARCHAR(100) | NULL | SATUSEHAT Organization ID |
| satusehat_client_id | VARCHAR(255) | NULL | Client ID SATUSEHAT |
| satusehat_client_secret | VARCHAR(255) | NULL | Client Secret (encrypted) |
| satusehat_environment | ENUM | DEFAULT 'sandbox' | sandbox, production |
| satusehat_token | TEXT | NULL | Access token cache |
| satusehat_token_expires_at | TIMESTAMP | NULL | Token expiry |
| setup_complete | BOOLEAN | DEFAULT FALSE | Setup wizard selesai? |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_name` (name)

---

#### **practitioners**
Data dokter/tenaga medis yang terdaftar di klinik.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Practitioner ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik tempat praktik |
| nik | VARCHAR(16) | NOT NULL | NIK dokter |
| name | VARCHAR(100) | NOT NULL | Nama lengkap |
| birth_date | DATE | NOT NULL | Tanggal lahir |
| gender | ENUM | NOT NULL | male, female |
| specialization | VARCHAR(100) | NULL | Spesialisasi (Dokter Gigi, Umum, dll) |
| satusehat_practitioner_id | VARCHAR(100) | NULL | SATUSEHAT Practitioner ID (N10000xxx) |
| is_active | BOOLEAN | DEFAULT TRUE | Status aktif |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_nik_clinic` (nik, clinic_id)
- KEY `idx_clinic_id` (clinic_id)

---

#### **locations**
Lokasi layanan (poli, ruang pemeriksaan) dalam klinik.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Location ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| name | VARCHAR(100) | NOT NULL | Nama lokasi (Poli Gigi, Ruang 1) |
| type | VARCHAR(20) | NOT NULL | HOSP, ROOM, DEPT |
| satusehat_location_id | VARCHAR(100) | NULL | SATUSEHAT Location ID |
| is_active | BOOLEAN | DEFAULT TRUE | Status aktif |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_clinic_id` (clinic_id)

---

### 1.2 PATIENT MANAGEMENT

#### **patients**
Data pasien.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Patient ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| no_rm | VARCHAR(20) | NOT NULL | Nomor Rekam Medis (000001, ...) |
| nik | VARCHAR(16) | NULL | NIK pasien (NULL untuk bayi tanpa NIK) |
| nik_ibu | VARCHAR(16) | NULL | NIK ibu (untuk bayi) |
| name | VARCHAR(100) | NOT NULL | Nama lengkap |
| birth_date | DATE | NOT NULL | Tanggal lahir |
| birth_order | INT | NULL | Urutan kelahiran (untuk kembar) |
| gender | ENUM | NOT NULL | male, female |
| phone | VARCHAR(20) | NULL | Nomor telepon |
| email | VARCHAR(100) | NULL | Email |
| address | TEXT | NULL | Alamat lengkap |
| city | VARCHAR(100) | NULL | Kota |
| province | VARCHAR(100) | NULL | Provinsi |
| postal_code | VARCHAR(10) | NULL | Kode pos |
| marital_status | ENUM | NULL | single, married, divorced, widowed |
| ihs_number | VARCHAR(50) | NULL | IHS Number dari SATUSEHAT (P02429547-xxx) |
| satusehat_patient_id | VARCHAR(100) | NULL | SATUSEHAT Patient ID |
| sync_status | ENUM | DEFAULT 'pending' | pending, synced, failed |
| sync_error | TEXT | NULL | Error message jika sync gagal |
| last_sync_at | TIMESTAMP | NULL | Waktu sync terakhir |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_no_rm_clinic` (no_rm, clinic_id)
- UNIQUE KEY `idx_nik_clinic` (nik, clinic_id)
- KEY `idx_clinic_id` (clinic_id)
- KEY `idx_ihs_number` (ihs_number)

---

#### **queues**
Antrian pasien (online booking & walk-in).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Queue ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| patient_id | INT | FK (patients), NULL | Patient ID (NULL jika belum terdaftar) |
| practitioner_id | INT | FK (practitioners), NOT NULL | Dokter yang dituju |
| nomor_antrian | INT | NOT NULL | Nomor antrian (reset harian) |
| tanggal | DATE | NOT NULL | Tanggal kunjungan |
| jam_slot | TIME | NOT NULL | Slot waktu (08:00, 08:30, ...) |
| patient_name | VARCHAR(100) | NOT NULL | Nama pasien (untuk booking tanpa login) |
| phone | VARCHAR(20) | NOT NULL | Telepon |
| chief_complaint | TEXT | NULL | Keluhan utama |
| is_first_visit | BOOLEAN | DEFAULT FALSE | Kunjungan pertama? |
| is_online_booking | BOOLEAN | DEFAULT FALSE | Booking online? |
| token | VARCHAR(8) | NOT NULL | Token untuk cek status (A3B7K9M2) |
| status | ENUM | DEFAULT 'waiting' | waiting, confirmed, called, done, cancelled |
| cancelled_reason | TEXT | NULL | Alasan cancel |
| called_at | TIMESTAMP | NULL | Waktu dipanggil |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_token` (token)
- UNIQUE KEY `idx_nomor_tanggal` (clinic_id, tanggal, nomor_antrian)
- KEY `idx_clinic_date_status` (clinic_id, tanggal, status)
- KEY `idx_practitioner_date` (practitioner_id, tanggal)

---

### 1.3 CLINICAL - ENCOUNTERS

#### **encounters**
Kunjungan pasien (1 encounter = 1 visit).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Encounter ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| patient_id | INT | FK (patients), NOT NULL | Pasien |
| practitioner_id | INT | FK (practitioners), NOT NULL | Dokter pemeriksa |
| location_id | INT | FK (locations), NOT NULL | Lokasi pemeriksaan |
| queue_id | INT | FK (queues), NULL | Antrian (jika dari antrian) |
| service_type | ENUM | DEFAULT 'outpatient' | outpatient, inpatient, emergency |
| chief_complaint | TEXT | NULL | Keluhan utama |
| status | ENUM | DEFAULT 'arrived' | arrived, in_progress, finished, cancelled |
| cancelled_reason | TEXT | NULL | Alasan dibatalkan |
| arrived_time | TIMESTAMP | NOT NULL | Waktu tiba |
| in_progress_time | TIMESTAMP | NULL | Waktu mulai pemeriksaan |
| finished_time | TIMESTAMP | NULL | Waktu selesai |
| satusehat_encounter_id | VARCHAR(100) | NULL | SATUSEHAT Encounter ID |
| sync_status | ENUM | DEFAULT 'pending' | pending, synced, failed |
| sync_error | TEXT | NULL | Error message |
| last_sync_at | TIMESTAMP | NULL | Waktu sync terakhir |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_clinic_id` (clinic_id)
- KEY `idx_patient_id` (patient_id)
- KEY `idx_practitioner_date` (practitioner_id, arrived_time)
- KEY `idx_status` (status)

---

### 1.4 CLINICAL - DOCUMENTATION

#### **anamnesis**
Anamnesis (riwayat penyakit & keluhan).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Anamnesis ID |
| encounter_id | INT | FK (encounters), UNIQUE, NOT NULL | Encounter (1-to-1) |
| keluhan_utama | TEXT | NOT NULL | Keluhan utama |
| riwayat_penyakit | TEXT | NULL | Riwayat penyakit |
| golongan_darah | ENUM | NULL | A, B, AB, O |
| rhesus | ENUM | NULL | +, - |
| status_kehamilan | ENUM | NULL | pregnant, not_pregnant |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_encounter_id` (encounter_id)

---

#### **allergies**
Data alergi pasien (per encounter).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Allergy ID |
| encounter_id | INT | FK (encounters), NOT NULL | Encounter |
| substansi | VARCHAR(100) | NOT NULL | Zat penyebab alergi |
| reaksi | TEXT | NOT NULL | Reaksi alergi |
| tingkat | ENUM | NOT NULL | low, moderate, high |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_encounter_id` (encounter_id)

---

#### **medication_history**
Riwayat obat yang sedang dikonsumsi pasien.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Medication History ID |
| encounter_id | INT | FK (encounters), NOT NULL | Encounter |
| nama_obat | VARCHAR(100) | NOT NULL | Nama obat |
| dosis | VARCHAR(50) | NOT NULL | Dosis (500mg, 2 tablet, dll) |
| frekuensi | VARCHAR(50) | NOT NULL | Frekuensi (3x sehari, dll) |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_encounter_id` (encounter_id)

---

#### **vital_signs**
Tanda-tanda vital pasien.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Vital Sign ID |
| encounter_id | INT | FK (encounters), NOT NULL | Encounter |
| loinc_code | VARCHAR(20) | NOT NULL | Kode LOINC (8480-6, 8462-4, dll) |
| name | VARCHAR(100) | NOT NULL | Nama (Tekanan Darah Sistolik) |
| value | DECIMAL(10,2) | NOT NULL | Nilai pengukuran |
| unit | VARCHAR(20) | NOT NULL | Satuan (mmHg, /menit, °C) |
| is_out_of_range | BOOLEAN | DEFAULT FALSE | Nilai di luar normal? |
| recorded_at | TIMESTAMP | NOT NULL | Waktu pencatatan |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_encounter_id` (encounter_id)
- KEY `idx_loinc_code` (loinc_code)

---

#### **diagnoses**
Diagnosis pasien (ICD-10).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Diagnosis ID |
| encounter_id | INT | FK (encounters), NOT NULL | Encounter |
| icd10_code | VARCHAR(10) | NOT NULL | Kode ICD-10 (K02.1) |
| icd10_display | VARCHAR(255) | NOT NULL | Deskripsi diagnosis |
| clinical_status | ENUM | DEFAULT 'active' | active, inactive, resolved, recurrence, relapse, remission |
| category | ENUM | DEFAULT 'encounter-diagnosis' | encounter-diagnosis, problem-list-item |
| body_site_code | VARCHAR(20) | NULL | Kode SNOMED untuk lokasi anatomi |
| body_site_display | VARCHAR(255) | NULL | Deskripsi lokasi anatomi |
| onset_date | DATE | NULL | Tanggal mulai |
| note | TEXT | NULL | Catatan tambahan |
| is_primary | BOOLEAN | DEFAULT FALSE | Diagnosis utama? (hanya 1 per encounter) |
| satusehat_condition_id | VARCHAR(100) | NULL | SATUSEHAT Condition ID |
| sync_status | ENUM | DEFAULT 'pending' | pending, synced, failed |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_encounter_id` (encounter_id)
- KEY `idx_icd10_code` (icd10_code)

---

#### **procedures**
Tindakan/prosedur medis (ICD-9).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Procedure ID |
| encounter_id | INT | FK (encounters), NOT NULL | Encounter |
| icd9_code | VARCHAR(10) | NOT NULL | Kode ICD-9-CM (96.54) |
| procedure_name | VARCHAR(255) | NOT NULL | Nama prosedur |
| status | ENUM | DEFAULT 'completed' | preparation, in_progress, completed, not_done, stopped |
| performed_start | TIMESTAMP | NOT NULL | Waktu mulai |
| performed_end | TIMESTAMP | NULL | Waktu selesai |
| reason_diagnosis_id | INT | FK (diagnoses), NULL | Diagnosis alasan tindakan |
| tooth_number | VARCHAR(5) | NULL | Nomor gigi (FDI: 11-18, 21-28, dll) |
| note | TEXT | NULL | Catatan tambahan |
| satusehat_procedure_id | VARCHAR(100) | NULL | SATUSEHAT Procedure ID |
| sync_status | ENUM | DEFAULT 'pending' | pending, synced, failed |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_encounter_id` (encounter_id)
- KEY `idx_icd9_code` (icd9_code)

---

#### **odontogram_data**
Data odontogram (khusus gigi).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Odontogram ID |
| encounter_id | INT | FK (encounters), UNIQUE, NOT NULL | Encounter (1-to-1) |
| teeth_data | JSON | NOT NULL | Data per gigi (surfaces, status, isRCT) |
| dmft_decayed | INT | DEFAULT 0 | DMF-T: Decayed |
| dmft_missing | INT | DEFAULT 0 | DMF-T: Missing |
| dmft_filled | INT | DEFAULT 0 | DMF-T: Filled |
| dmft_total | INT | DEFAULT 0 | DMF-T: Total |
| additional_findings | JSON | NULL | Temuan tambahan (occlusion, diastema, anomaly) |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_encounter_id` (encounter_id)

---

#### **ohis_data**
Data OHI-S (Oral Hygiene Index Simplified).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | OHIS ID |
| encounter_id | INT | FK (encounters), UNIQUE, NOT NULL | Encounter (1-to-1) |
| scores | JSON | NOT NULL | Skor per gigi (16, 11, 26, 46, 31, 36) |
| di_s | DECIMAL(4,2) | NOT NULL | Debris Index Simplified |
| ci_s | DECIMAL(4,2) | NOT NULL | Calculus Index Simplified |
| ohi_s | DECIMAL(4,2) | NOT NULL | OHI-S Total |
| interpretation | VARCHAR(50) | NOT NULL | Baik, Sedang, Buruk |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_encounter_id` (encounter_id)

---

### 1.5 PHARMACY

#### **medications**
Master data obat.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Medication ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| name | VARCHAR(100) | NOT NULL | Nama obat (Amoxicillin 500mg) |
| generic_name | VARCHAR(100) | NULL | Nama generik |
| strength | VARCHAR(50) | NULL | Kekuatan (500mg) |
| strength_unit | VARCHAR(20) | NULL | Satuan (mg, ml) |
| dosage_form | VARCHAR(50) | NOT NULL | Bentuk sediaan (kapsul, tablet, sirup) |
| quantity | INT | DEFAULT 0 | Stok saat ini |
| min_stock | INT | DEFAULT 0 | Batas minimum stok |
| price | DECIMAL(10,2) | DEFAULT 0 | Harga jual per unit |
| supplier | VARCHAR(100) | NULL | Nama supplier |
| expiration_date | DATE | NULL | Tanggal kadaluarsa |
| is_active | BOOLEAN | DEFAULT TRUE | Status aktif |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_clinic_id` (clinic_id)
- KEY `idx_name` (name)
- KEY `idx_low_stock` (clinic_id, quantity, min_stock)

---

#### **prescriptions**
Resep obat.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Prescription ID |
| encounter_id | INT | FK (encounters), NOT NULL | Encounter |
| medication_id | INT | FK (medications), NOT NULL | Obat |
| dosage_instruction | VARCHAR(255) | NOT NULL | Aturan pakai (3x1 kapsul sesudah makan) |
| quantity | INT | NOT NULL | Jumlah yang diresepkan |
| duration | INT | NULL | Lama konsumsi |
| duration_unit | ENUM | NULL | days, weeks, months |
| note | TEXT | NULL | Catatan tambahan |
| status | ENUM | DEFAULT 'active' | active, dispensed, cancelled |
| dispensed_at | TIMESTAMP | NULL | Waktu obat dikeluarkan |
| satusehat_medreq_id | VARCHAR(100) | NULL | SATUSEHAT MedicationRequest ID |
| sync_status | ENUM | DEFAULT 'pending' | pending, synced, failed |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_encounter_id` (encounter_id)
- KEY `idx_medication_id` (medication_id)

---

#### **dispenses**
Pengeluaran obat dari resep.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Dispense ID |
| encounter_id | INT | FK (encounters), NOT NULL | Encounter |
| prescription_id | INT | FK (prescriptions), NOT NULL | Resep |
| medication_id | INT | FK (medications), NOT NULL | Obat |
| quantity_dispensed | INT | NOT NULL | Jumlah yang dikeluarkan |
| dispensed_at | TIMESTAMP | NOT NULL | Waktu pengeluaran |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_encounter_id` (encounter_id)
- KEY `idx_prescription_id` (prescription_id)

---

#### **medication_stock_logs**
Log perubahan stok obat.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Log ID |
| medication_id | INT | FK (medications), NOT NULL | Obat |
| type | ENUM | NOT NULL | in (masuk), out (keluar), adjustment |
| quantity | INT | NOT NULL | Jumlah perubahan (+/-) |
| previous_quantity | INT | NOT NULL | Stok sebelum |
| new_quantity | INT | NOT NULL | Stok sesudah |
| reason | VARCHAR(255) | NOT NULL | Alasan perubahan |
| batch_no | VARCHAR(50) | NULL | Nomor batch |
| expiration_date | DATE | NULL | Tanggal kadaluarsa batch |
| reference_id | INT | NULL | ID referensi (dispense_id jika type=out) |
| reference_type | VARCHAR(50) | NULL | Tipe referensi (dispense, purchase, adjustment) |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_medication_id` (medication_id)
- KEY `idx_created_at` (created_at)

---

### 1.6 BILLING

#### **tarifs**
Master tarif layanan.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Tarif ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| name | VARCHAR(100) | NOT NULL | Nama layanan |
| kategori | VARCHAR(50) | NOT NULL | Konsultasi, Tindakan, Lab, dll |
| kode_icd9 | VARCHAR(10) | NULL | Kode ICD-9 (jika tindakan) |
| harga_pokok | DECIMAL(10,2) | DEFAULT 0 | Harga pokok |
| harga_jual | DECIMAL(10,2) | NOT NULL | Harga jual |
| diskon_maksimal | DECIMAL(10,2) | DEFAULT 0 | Diskon maksimal yang boleh diberikan |
| is_active | BOOLEAN | DEFAULT TRUE | Status aktif |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_clinic_id` (clinic_id)
- KEY `idx_kategori` (kategori)

---

#### **billings**
Tagihan pasien.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Billing ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| encounter_id | INT | FK (encounters), NOT NULL | Encounter |
| patient_id | INT | FK (patients), NOT NULL | Pasien |
| invoice_number | VARCHAR(50) | UNIQUE, NOT NULL | Nomor invoice (INV-2026-00042) |
| subtotal | DECIMAL(10,2) | NOT NULL | Subtotal sebelum diskon |
| total_discount | DECIMAL(10,2) | DEFAULT 0 | Total diskon |
| grand_total | DECIMAL(10,2) | NOT NULL | Total akhir |
| paid_amount | DECIMAL(10,2) | DEFAULT 0 | Total yang sudah dibayar |
| outstanding_amount | DECIMAL(10,2) | NOT NULL | Sisa tagihan |
| status | ENUM | DEFAULT 'unpaid' | unpaid, partial, paid, cancelled, refunded |
| notes | TEXT | NULL | Catatan |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_invoice_number` (invoice_number)
- KEY `idx_clinic_id` (clinic_id)
- KEY `idx_encounter_id` (encounter_id)
- KEY `idx_status` (status)

---

#### **billing_items**
Item-item dalam tagihan.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Billing Item ID |
| billing_id | INT | FK (billings), NOT NULL | Billing |
| tarif_id | INT | FK (tarifs), NULL | Tarif (NULL jika custom item) |
| name | VARCHAR(100) | NOT NULL | Nama item |
| quantity | INT | DEFAULT 1 | Jumlah |
| unit_price | DECIMAL(10,2) | NOT NULL | Harga satuan |
| discount | DECIMAL(10,2) | DEFAULT 0 | Diskon per item |
| discount_type | ENUM | DEFAULT 'nominal' | nominal, percent |
| subtotal | DECIMAL(10,2) | NOT NULL | Subtotal item (after discount) |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_billing_id` (billing_id)

---

#### **payments**
Pembayaran tagihan.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Payment ID |
| billing_id | INT | FK (billings), NOT NULL | Billing |
| receipt_number | VARCHAR(50) | UNIQUE, NOT NULL | Nomor kwitansi (RCP-2026-00042) |
| method | ENUM | NOT NULL | cash, transfer, insurance, bpjs |
| amount | DECIMAL(10,2) | NOT NULL | Jumlah dibayar |
| note | TEXT | NULL | Catatan |
| paid_at | TIMESTAMP | NOT NULL | Waktu pembayaran |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- UNIQUE KEY `idx_receipt_number` (receipt_number)
- KEY `idx_billing_id` (billing_id)

---

#### **refund_requests**
Permintaan refund (butuh approval Owner).

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Refund Request ID |
| billing_id | INT | FK (billings), NOT NULL | Billing |
| amount | DECIMAL(10,2) | NOT NULL | Jumlah refund |
| reason | TEXT | NOT NULL | Alasan refund |
| status | ENUM | DEFAULT 'pending_approval' | pending_approval, approved, rejected, processed |
| approved_by | INT | FK (users), NULL | User yang approve/reject |
| approved_at | TIMESTAMP | NULL | Waktu approval |
| approval_note | TEXT | NULL | Catatan approval |
| processed_at | TIMESTAMP | NULL | Waktu diproses (uang dikembalikan) |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_billing_id` (billing_id)
- KEY `idx_status` (status)

---

### 1.7 TEMPLATES & SETTINGS

#### **soap_templates**
Template dokumentasi SOAP untuk efisiensi.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Template ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| name | VARCHAR(100) | NOT NULL | Nama template |
| subjective | TEXT | NULL | Template Subjective |
| objective | TEXT | NULL | Template Objective |
| assessment | TEXT | NULL | Template Assessment |
| plan | TEXT | NULL | Template Plan |
| is_shared | BOOLEAN | DEFAULT FALSE | Shared ke semua dokter? (FALSE = personal) |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |
| created_by | INT | FK (users), NULL | User yang membuat |
| updated_by | INT | FK (users), NULL | User yang update |

**Indexes:**
- KEY `idx_clinic_id` (clinic_id)
- KEY `idx_created_by` (created_by)

---

### 1.8 INTEGRATION

#### **satusehat_sync_logs**
Log sinkronisasi ke SATUSEHAT.

| Field | Type | Constraint | Description |
|-------|------|------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Log ID |
| clinic_id | INT | FK (clinics), NOT NULL | Klinik |
| resource_type | VARCHAR(50) | NOT NULL | Patient, Encounter, Condition, dll |
| local_id | INT | NOT NULL | ID lokal (patient_id, encounter_id, dll) |
| satusehat_id | VARCHAR(100) | NULL | ID resource di SATUSEHAT |
| operation | ENUM | NOT NULL | create, update, delete |
| status | ENUM | NOT NULL | success, failed, pending |
| http_status | INT | NULL | HTTP status code (200, 400, dll) |
| request_payload | JSON | NULL | Request yang dikirim |
| response_payload | JSON | NULL | Response dari SATUSEHAT |
| error_message | TEXT | NULL | Error message jika gagal |
| retry_count | INT | DEFAULT 0 | Jumlah retry |
| last_retry_at | TIMESTAMP | NULL | Waktu retry terakhir |
| created_at | TIMESTAMP | NOT NULL | Audit: created |
| updated_at | TIMESTAMP | NOT NULL | Audit: updated |

**Indexes:**
- KEY `idx_clinic_id` (clinic_id)
- KEY `idx_resource_local` (resource_type, local_id)
- KEY `idx_status` (status)
- KEY `idx_created_at` (created_at)

---

## 2. RELASI ANTAR ENTITAS

### 2.1 ONE-TO-ONE
| Parent | Child | Description |
|--------|-------|-------------|
| encounters | anamnesis | 1 encounter memiliki 1 anamnesis |
| encounters | odontogram_data | 1 encounter memiliki 1 odontogram (opsional) |
| encounters | ohis_data | 1 encounter memiliki 1 OHI-S (opsional) |

### 2.2 ONE-TO-MANY
| Parent (One) | Child (Many) | FK di Child | Description |
|--------------|--------------|-------------|-------------|
| clinics | users | clinic_id | 1 klinik → banyak user |
| clinics | practitioners | clinic_id | 1 klinik → banyak dokter |
| clinics | locations | clinic_id | 1 klinik → banyak lokasi |
| clinics | patients | clinic_id | 1 klinik → banyak pasien |
| clinics | queues | clinic_id | 1 klinik → banyak antrian |
| clinics | encounters | clinic_id | 1 klinik → banyak encounter |
| clinics | medications | clinic_id | 1 klinik → banyak obat |
| clinics | tarifs | clinic_id | 1 klinik → banyak tarif |
| clinics | billings | clinic_id | 1 klinik → banyak billing |
| clinics | soap_templates | clinic_id | 1 klinik → banyak template |
| clinics | satusehat_sync_logs | clinic_id | 1 klinik → banyak log sync |
| practitioners | users | practitioner_id | 1 dokter → 1 user (dokter) |
| practitioners | queues | practitioner_id | 1 dokter → banyak antrian |
| practitioners | encounters | practitioner_id | 1 dokter → banyak encounter |
| patients | encounters | patient_id | 1 pasien → banyak encounter |
| patients | queues | patient_id | 1 pasien → banyak antrian |
| patients | billings | patient_id | 1 pasien → banyak billing |
| locations | encounters | location_id | 1 lokasi → banyak encounter |
| queues | encounters | queue_id | 1 antrian → 1 encounter (opsional) |
| encounters | allergies | encounter_id | 1 encounter → banyak alergi |
| encounters | medication_history | encounter_id | 1 encounter → banyak riwayat obat |
| encounters | vital_signs | encounter_id | 1 encounter → banyak vital signs |
| encounters | diagnoses | encounter_id | 1 encounter → banyak diagnosis |
| encounters | procedures | encounter_id | 1 encounter → banyak prosedur |
| encounters | prescriptions | encounter_id | 1 encounter → banyak resep |
| encounters | dispenses | encounter_id | 1 encounter → banyak dispense |
| medications | prescriptions | medication_id | 1 obat → banyak resep |
| medications | dispenses | medication_id | 1 obat → banyak dispense |
| medications | medication_stock_logs | medication_id | 1 obat → banyak log stok |
| prescriptions | dispenses | prescription_id | 1 resep → 1 dispense |
| tarifs | billing_items | tarif_id | 1 tarif → banyak item billing |
| billings | billing_items | billing_id | 1 billing → banyak item |
| billings | payments | billing_id | 1 billing → banyak payment |
| billings | refund_requests | billing_id | 1 billing → banyak refund request |
| diagnoses | procedures | reason_diagnosis_id | 1 diagnosis → banyak prosedur (alasan) |

### 2.3 MANY-TO-MANY (Implicit - No Junction Table)
Tidak ada relasi many-to-many dalam desain ini. Semua relasi sudah dibuat eksplisit melalui foreign key.

---

## 3. ERD DIAGRAM (MERMAID)

```mermaid
erDiagram
    %% ========================================
    %% CORE SYSTEM
    %% ========================================
    
    clinics ||--o{ users : has
    clinics ||--o{ practitioners : has
    clinics ||--o{ locations : has
    clinics ||--o{ patients : has
    clinics ||--o{ queues : has
    clinics ||--o{ encounters : has
    clinics ||--o{ medications : has
    clinics ||--o{ tarifs : has
    clinics ||--o{ billings : has
    clinics ||--o{ soap_templates : has
    clinics ||--o{ satusehat_sync_logs : has
    
    practitioners ||--o| users : "is linked to"
    practitioners ||--o{ queues : "receives"
    practitioners ||--o{ encounters : "performs"
    
    users ||--o{ users : "creates/updates"
    
    %% ========================================
    %% PATIENT MANAGEMENT
    %% ========================================
    
    patients ||--o{ queues : "books"
    patients ||--o{ encounters : "visits"
    patients ||--o{ billings : "has"
    
    queues ||--o| encounters : "generates"
    
    locations ||--o{ encounters : "hosts"
    
    %% ========================================
    %% CLINICAL - ENCOUNTERS & DOCUMENTATION
    %% ========================================
    
    encounters ||--|| anamnesis : "has"
    encounters ||--o{ allergies : "has"
    encounters ||--o{ medication_history : "has"
    encounters ||--o{ vital_signs : "has"
    encounters ||--o{ diagnoses : "has"
    encounters ||--o{ procedures : "has"
    encounters ||--|| odontogram_data : "has (optional)"
    encounters ||--|| ohis_data : "has (optional)"
    encounters ||--o{ prescriptions : "has"
    encounters ||--o{ dispenses : "has"
    
    diagnoses ||--o{ procedures : "reasons"
    
    %% ========================================
    %% PHARMACY
    %% ========================================
    
    medications ||--o{ prescriptions : "prescribed in"
    medications ||--o{ dispenses : "dispensed in"
    medications ||--o{ medication_stock_logs : "logged"
    
    prescriptions ||--|| dispenses : "fulfilled by"
    
    %% ========================================
    %% BILLING
    %% ========================================
    
    tarifs ||--o{ billing_items : "used in"
    
    billings ||--o{ billing_items : "contains"
    billings ||--o{ payments : "paid by"
    billings ||--o{ refund_requests : "has"
    
    %% ========================================
    %% ENTITY DEFINITIONS
    %% ========================================
    
    clinics {
        int id PK
        varchar name
        text address
        varchar city
        varchar province
        varchar postal_code
        varchar phone
        varchar email
        varchar sip_number
        json operational_hours
        varchar satusehat_org_id
        varchar satusehat_client_id
        varchar satusehat_client_secret
        enum satusehat_environment
        text satusehat_token
        timestamp satusehat_token_expires_at
        boolean setup_complete
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    users {
        int id PK
        int clinic_id FK
        int practitioner_id FK
        varchar email UK
        varchar password_hash
        varchar name
        enum role
        boolean is_active
        timestamp email_verified_at
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    practitioners {
        int id PK
        int clinic_id FK
        varchar nik
        varchar name
        date birth_date
        enum gender
        varchar specialization
        varchar satusehat_practitioner_id
        boolean is_active
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    locations {
        int id PK
        int clinic_id FK
        varchar name
        varchar type
        varchar satusehat_location_id
        boolean is_active
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    patients {
        int id PK
        int clinic_id FK
        varchar no_rm
        varchar nik
        varchar nik_ibu
        varchar name
        date birth_date
        int birth_order
        enum gender
        varchar phone
        varchar email
        text address
        varchar city
        varchar province
        varchar postal_code
        enum marital_status
        varchar ihs_number
        varchar satusehat_patient_id
        enum sync_status
        text sync_error
        timestamp last_sync_at
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    queues {
        int id PK
        int clinic_id FK
        int patient_id FK
        int practitioner_id FK
        int nomor_antrian
        date tanggal
        time jam_slot
        varchar patient_name
        varchar phone
        text chief_complaint
        boolean is_first_visit
        boolean is_online_booking
        varchar token UK
        enum status
        text cancelled_reason
        timestamp called_at
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    encounters {
        int id PK
        int clinic_id FK
        int patient_id FK
        int practitioner_id FK
        int location_id FK
        int queue_id FK
        enum service_type
        text chief_complaint
        enum status
        text cancelled_reason
        timestamp arrived_time
        timestamp in_progress_time
        timestamp finished_time
        varchar satusehat_encounter_id
        enum sync_status
        text sync_error
        timestamp last_sync_at
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    anamnesis {
        int id PK
        int encounter_id FK_UK
        text keluhan_utama
        text riwayat_penyakit
        enum golongan_darah
        enum rhesus
        enum status_kehamilan
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    allergies {
        int id PK
        int encounter_id FK
        varchar substansi
        text reaksi
        enum tingkat
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    medication_history {
        int id PK
        int encounter_id FK
        varchar nama_obat
        varchar dosis
        varchar frekuensi
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    vital_signs {
        int id PK
        int encounter_id FK
        varchar loinc_code
        varchar name
        decimal value
        varchar unit
        boolean is_out_of_range
        timestamp recorded_at
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    diagnoses {
        int id PK
        int encounter_id FK
        varchar icd10_code
        varchar icd10_display
        enum clinical_status
        enum category
        varchar body_site_code
        varchar body_site_display
        date onset_date
        text note
        boolean is_primary
        varchar satusehat_condition_id
        enum sync_status
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    procedures {
        int id PK
        int encounter_id FK
        varchar icd9_code
        varchar procedure_name
        enum status
        timestamp performed_start
        timestamp performed_end
        int reason_diagnosis_id FK
        varchar tooth_number
        text note
        varchar satusehat_procedure_id
        enum sync_status
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    odontogram_data {
        int id PK
        int encounter_id FK_UK
        json teeth_data
        int dmft_decayed
        int dmft_missing
        int dmft_filled
        int dmft_total
        json additional_findings
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    ohis_data {
        int id PK
        int encounter_id FK_UK
        json scores
        decimal di_s
        decimal ci_s
        decimal ohi_s
        varchar interpretation
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    medications {
        int id PK
        int clinic_id FK
        varchar name
        varchar generic_name
        varchar strength
        varchar strength_unit
        varchar dosage_form
        int quantity
        int min_stock
        decimal price
        varchar supplier
        date expiration_date
        boolean is_active
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    prescriptions {
        int id PK
        int encounter_id FK
        int medication_id FK
        varchar dosage_instruction
        int quantity
        int duration
        enum duration_unit
        text note
        enum status
        timestamp dispensed_at
        varchar satusehat_medreq_id
        enum sync_status
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    dispenses {
        int id PK
        int encounter_id FK
        int prescription_id FK
        int medication_id FK
        int quantity_dispensed
        timestamp dispensed_at
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    medication_stock_logs {
        int id PK
        int medication_id FK
        enum type
        int quantity
        int previous_quantity
        int new_quantity
        varchar reason
        varchar batch_no
        date expiration_date
        int reference_id
        varchar reference_type
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    tarifs {
        int id PK
        int clinic_id FK
        varchar name
        varchar kategori
        varchar kode_icd9
        decimal harga_pokok
        decimal harga_jual
        decimal diskon_maksimal
        boolean is_active
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    billings {
        int id PK
        int clinic_id FK
        int encounter_id FK
        int patient_id FK
        varchar invoice_number UK
        decimal subtotal
        decimal total_discount
        decimal grand_total
        decimal paid_amount
        decimal outstanding_amount
        enum status
        text notes
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    billing_items {
        int id PK
        int billing_id FK
        int tarif_id FK
        varchar name
        int quantity
        decimal unit_price
        decimal discount
        enum discount_type
        decimal subtotal
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    payments {
        int id PK
        int billing_id FK
        varchar receipt_number UK
        enum method
        decimal amount
        text note
        timestamp paid_at
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    refund_requests {
        int id PK
        int billing_id FK
        decimal amount
        text reason
        enum status
        int approved_by FK
        timestamp approved_at
        text approval_note
        timestamp processed_at
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    soap_templates {
        int id PK
        int clinic_id FK
        varchar name
        text subjective
        text objective
        text assessment
        text plan
        boolean is_shared
        timestamp created_at
        timestamp updated_at
        int created_by FK
        int updated_by FK
    }
    
    satusehat_sync_logs {
        int id PK
        int clinic_id FK
        varchar resource_type
        int local_id
        varchar satusehat_id
        enum operation
        enum status
        int http_status
        json request_payload
        json response_payload
        text error_message
        int retry_count
        timestamp last_retry_at
        timestamp created_at
        timestamp updated_at
    }
```

---


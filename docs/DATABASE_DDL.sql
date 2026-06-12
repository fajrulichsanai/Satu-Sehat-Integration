-- ==========================================
-- DATABASE DEFINITION - ApexRecord
-- MySQL 8.0+ with InnoDB Engine
-- Character Set: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- Generated: 2026-06-11
-- ==========================================

-- Create Database
CREATE DATABASE IF NOT EXISTS apexrecord
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE apexrecord;

-- ==========================================
-- CORE SYSTEM TABLES
-- ==========================================

-- Table: clinics
CREATE TABLE clinics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    postal_code VARCHAR(10) DEFAULT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) DEFAULT NULL,
    sip_number VARCHAR(50) DEFAULT NULL,
    operational_hours JSON DEFAULT NULL COMMENT 'Jam operasional per hari (Senin-Minggu)',
    satusehat_org_id VARCHAR(100) DEFAULT NULL COMMENT 'SATUSEHAT Organization ID',
    satusehat_client_id VARCHAR(255) DEFAULT NULL,
    satusehat_client_secret VARCHAR(255) DEFAULT NULL COMMENT 'Encrypted',
    satusehat_environment ENUM('sandbox', 'production') DEFAULT 'sandbox',
    satusehat_token TEXT DEFAULT NULL COMMENT 'Access token cache',
    satusehat_token_expires_at TIMESTAMP NULL DEFAULT NULL,
    setup_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT DEFAULT NULL COMMENT 'NULL for pending users',
    practitioner_id INT DEFAULT NULL COMMENT 'ID practitioner jika role = dokter',
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt hash',
    name VARCHAR(100) NOT NULL,
    role ENUM('owner', 'admin', 'dokter', 'pending') NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP NULL DEFAULT NULL,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_email (email),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_role_active (role, is_active),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL,
    FOREIGN KEY (practitioner_id) REFERENCES practitioners(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: practitioners
CREATE TABLE practitioners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    nik VARCHAR(16) NOT NULL COMMENT 'NIK dokter',
    name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    gender ENUM('male', 'female') NOT NULL,
    specialization VARCHAR(100) DEFAULT NULL COMMENT 'Dokter Gigi, Umum, dll',
    satusehat_practitioner_id VARCHAR(100) DEFAULT NULL COMMENT 'SATUSEHAT Practitioner ID (N10000xxx)',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_nik_clinic (nik, clinic_id),
    INDEX idx_clinic_id (clinic_id),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: locations
CREATE TABLE locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT 'Nama lokasi (Poli Gigi, Ruang 1)',
    type VARCHAR(20) NOT NULL COMMENT 'HOSP, ROOM, DEPT',
    satusehat_location_id VARCHAR(100) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_clinic_id (clinic_id),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- PATIENT MANAGEMENT TABLES
-- ==========================================

-- Table: patients
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    no_rm VARCHAR(20) NOT NULL COMMENT 'Nomor Rekam Medis (000001, ...)',
    nik VARCHAR(16) DEFAULT NULL COMMENT 'NIK pasien (NULL untuk bayi tanpa NIK)',
    nik_ibu VARCHAR(16) DEFAULT NULL COMMENT 'NIK ibu (untuk bayi)',
    name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    birth_order INT DEFAULT NULL COMMENT 'Urutan kelahiran (untuk kembar)',
    gender ENUM('male', 'female') NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    email VARCHAR(100) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    province VARCHAR(100) DEFAULT NULL,
    postal_code VARCHAR(10) DEFAULT NULL,
    marital_status ENUM('single', 'married', 'divorced', 'widowed') DEFAULT NULL,
    ihs_number VARCHAR(50) DEFAULT NULL COMMENT 'IHS Number dari SATUSEHAT (P02429547-xxx)',
    satusehat_patient_id VARCHAR(100) DEFAULT NULL,
    sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
    sync_error TEXT DEFAULT NULL,
    last_sync_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_no_rm_clinic (no_rm, clinic_id),
    UNIQUE KEY idx_nik_clinic (nik, clinic_id),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_ihs_number (ihs_number),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: queues
CREATE TABLE queues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    patient_id INT DEFAULT NULL COMMENT 'NULL jika belum terdaftar',
    practitioner_id INT NOT NULL,
    nomor_antrian INT NOT NULL COMMENT 'Nomor antrian (reset harian)',
    tanggal DATE NOT NULL,
    jam_slot TIME NOT NULL COMMENT 'Slot waktu (08:00, 08:30, ...)',
    patient_name VARCHAR(100) NOT NULL COMMENT 'Nama pasien (untuk booking tanpa login)',
    phone VARCHAR(20) NOT NULL,
    chief_complaint TEXT DEFAULT NULL,
    is_first_visit BOOLEAN DEFAULT FALSE,
    is_online_booking BOOLEAN DEFAULT FALSE,
    token VARCHAR(8) NOT NULL COMMENT 'Token untuk cek status (A3B7K9M2)',
    status ENUM('waiting', 'confirmed', 'called', 'done', 'cancelled') DEFAULT 'waiting',
    cancelled_reason TEXT DEFAULT NULL,
    called_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_token (token),
    UNIQUE KEY idx_nomor_tanggal (clinic_id, tanggal, nomor_antrian),
    INDEX idx_clinic_date_status (clinic_id, tanggal, status),
    INDEX idx_practitioner_date (practitioner_id, tanggal),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    FOREIGN KEY (practitioner_id) REFERENCES practitioners(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- CLINICAL - ENCOUNTERS
-- ==========================================

-- Table: encounters
CREATE TABLE encounters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    patient_id INT NOT NULL,
    practitioner_id INT NOT NULL,
    location_id INT NOT NULL,
    queue_id INT DEFAULT NULL COMMENT 'Antrian (jika dari antrian)',
    service_type ENUM('outpatient', 'inpatient', 'emergency') DEFAULT 'outpatient',
    chief_complaint TEXT DEFAULT NULL,
    status ENUM('arrived', 'in_progress', 'finished', 'cancelled') DEFAULT 'arrived',
    cancelled_reason TEXT DEFAULT NULL,
    arrived_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    in_progress_time TIMESTAMP NULL DEFAULT NULL,
    finished_time TIMESTAMP NULL DEFAULT NULL,
    satusehat_encounter_id VARCHAR(100) DEFAULT NULL,
    sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
    sync_error TEXT DEFAULT NULL,
    last_sync_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_patient_id (patient_id),
    INDEX idx_practitioner_date (practitioner_id, arrived_time),
    INDEX idx_status (status),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (practitioner_id) REFERENCES practitioners(id) ON DELETE RESTRICT,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
    FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- CLINICAL - DOCUMENTATION
-- ==========================================

-- Table: anamnesis
CREATE TABLE anamnesis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL UNIQUE COMMENT '1-to-1 with encounters',
    keluhan_utama TEXT NOT NULL,
    riwayat_penyakit TEXT DEFAULT NULL,
    golongan_darah ENUM('A', 'B', 'AB', 'O') DEFAULT NULL,
    rhesus ENUM('+', '-') DEFAULT NULL,
    status_kehamilan ENUM('pregnant', 'not_pregnant') DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_encounter_id (encounter_id),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: allergies
CREATE TABLE allergies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL,
    substansi VARCHAR(100) NOT NULL COMMENT 'Zat penyebab alergi',
    reaksi TEXT NOT NULL,
    tingkat ENUM('low', 'moderate', 'high') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_encounter_id (encounter_id),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: medication_history
CREATE TABLE medication_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL,
    nama_obat VARCHAR(100) NOT NULL,
    dosis VARCHAR(50) NOT NULL,
    frekuensi VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_encounter_id (encounter_id),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: vital_signs
CREATE TABLE vital_signs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL,
    loinc_code VARCHAR(20) NOT NULL COMMENT 'Kode LOINC (8480-6, 8462-4, dll)',
    name VARCHAR(100) NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL COMMENT 'Satuan (mmHg, /menit, °C)',
    is_out_of_range BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_encounter_id (encounter_id),
    INDEX idx_loinc_code (loinc_code),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: diagnoses
CREATE TABLE diagnoses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL,
    icd10_code VARCHAR(10) NOT NULL COMMENT 'Kode ICD-10 (K02.1)',
    icd10_display VARCHAR(255) NOT NULL,
    clinical_status ENUM('active', 'inactive', 'resolved', 'recurrence', 'relapse', 'remission') DEFAULT 'active',
    category ENUM('encounter-diagnosis', 'problem-list-item') DEFAULT 'encounter-diagnosis',
    body_site_code VARCHAR(20) DEFAULT NULL COMMENT 'Kode SNOMED untuk lokasi anatomi',
    body_site_display VARCHAR(255) DEFAULT NULL,
    onset_date DATE DEFAULT NULL,
    note TEXT DEFAULT NULL,
    is_primary BOOLEAN DEFAULT FALSE COMMENT 'Diagnosis utama (hanya 1 per encounter)',
    satusehat_condition_id VARCHAR(100) DEFAULT NULL,
    sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_encounter_id (encounter_id),
    INDEX idx_icd10_code (icd10_code),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: procedures
CREATE TABLE procedures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL,
    icd9_code VARCHAR(10) NOT NULL COMMENT 'Kode ICD-9-CM (96.54)',
    procedure_name VARCHAR(255) NOT NULL,
    status ENUM('preparation', 'in_progress', 'completed', 'not_done', 'stopped') DEFAULT 'completed',
    performed_start TIMESTAMP NOT NULL,
    performed_end TIMESTAMP NULL DEFAULT NULL,
    reason_diagnosis_id INT DEFAULT NULL COMMENT 'Diagnosis alasan tindakan',
    tooth_number VARCHAR(5) DEFAULT NULL COMMENT 'Nomor gigi (FDI: 11-18, 21-28, dll)',
    note TEXT DEFAULT NULL,
    satusehat_procedure_id VARCHAR(100) DEFAULT NULL,
    sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_encounter_id (encounter_id),
    INDEX idx_icd9_code (icd9_code),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (reason_diagnosis_id) REFERENCES diagnoses(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: odontogram_data
CREATE TABLE odontogram_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL UNIQUE COMMENT '1-to-1 with encounters',
    teeth_data JSON NOT NULL COMMENT 'Data per gigi (surfaces, status, isRCT)',
    dmft_decayed INT DEFAULT 0,
    dmft_missing INT DEFAULT 0,
    dmft_filled INT DEFAULT 0,
    dmft_total INT DEFAULT 0,
    additional_findings JSON DEFAULT NULL COMMENT 'Temuan tambahan (occlusion, diastema, anomaly)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_encounter_id (encounter_id),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: ohis_data
CREATE TABLE ohis_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL UNIQUE COMMENT '1-to-1 with encounters',
    scores JSON NOT NULL COMMENT 'Skor per gigi (16, 11, 26, 46, 31, 36)',
    di_s DECIMAL(4,2) NOT NULL COMMENT 'Debris Index Simplified',
    ci_s DECIMAL(4,2) NOT NULL COMMENT 'Calculus Index Simplified',
    ohi_s DECIMAL(4,2) NOT NULL COMMENT 'OHI-S Total',
    interpretation VARCHAR(50) NOT NULL COMMENT 'Baik, Sedang, Buruk',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_encounter_id (encounter_id),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- PHARMACY TABLES
-- ==========================================

-- Table: medications
CREATE TABLE medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT 'Nama obat (Amoxicillin 500mg)',
    generic_name VARCHAR(100) DEFAULT NULL,
    strength VARCHAR(50) DEFAULT NULL COMMENT 'Kekuatan (500mg)',
    strength_unit VARCHAR(20) DEFAULT NULL COMMENT 'Satuan (mg, ml)',
    dosage_form VARCHAR(50) NOT NULL COMMENT 'Bentuk sediaan (kapsul, tablet, sirup)',
    quantity INT DEFAULT 0 COMMENT 'Stok saat ini',
    min_stock INT DEFAULT 0 COMMENT 'Batas minimum stok',
    price DECIMAL(10,2) DEFAULT 0 COMMENT 'Harga jual per unit',
    supplier VARCHAR(100) DEFAULT NULL,
    expiration_date DATE DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_name (name),
    INDEX idx_low_stock (clinic_id, quantity, min_stock),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: prescriptions
CREATE TABLE prescriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL,
    medication_id INT NOT NULL,
    dosage_instruction VARCHAR(255) NOT NULL COMMENT 'Aturan pakai (3x1 kapsul sesudah makan)',
    quantity INT NOT NULL COMMENT 'Jumlah yang diresepkan',
    duration INT DEFAULT NULL COMMENT 'Lama konsumsi',
    duration_unit ENUM('days', 'weeks', 'months') DEFAULT NULL,
    note TEXT DEFAULT NULL,
    status ENUM('active', 'dispensed', 'cancelled') DEFAULT 'active',
    dispensed_at TIMESTAMP NULL DEFAULT NULL,
    satusehat_medreq_id VARCHAR(100) DEFAULT NULL,
    sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_encounter_id (encounter_id),
    INDEX idx_medication_id (medication_id),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: dispenses
CREATE TABLE dispenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encounter_id INT NOT NULL,
    prescription_id INT NOT NULL,
    medication_id INT NOT NULL,
    quantity_dispensed INT NOT NULL COMMENT 'Jumlah yang dikeluarkan',
    dispensed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_encounter_id (encounter_id),
    INDEX idx_prescription_id (prescription_id),
    
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE RESTRICT,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: medication_stock_logs
CREATE TABLE medication_stock_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medication_id INT NOT NULL,
    type ENUM('in', 'out', 'adjustment') NOT NULL COMMENT 'in (masuk), out (keluar), adjustment',
    quantity INT NOT NULL COMMENT 'Jumlah perubahan (+/-)',
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    batch_no VARCHAR(50) DEFAULT NULL,
    expiration_date DATE DEFAULT NULL,
    reference_id INT DEFAULT NULL COMMENT 'ID referensi (dispense_id jika type=out)',
    reference_type VARCHAR(50) DEFAULT NULL COMMENT 'Tipe referensi (dispense, purchase, adjustment)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_medication_id (medication_id),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- BILLING TABLES
-- ==========================================

-- Table: tarifs
CREATE TABLE tarifs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    kategori VARCHAR(50) NOT NULL COMMENT 'Konsultasi, Tindakan, Lab, dll',
    kode_icd9 VARCHAR(10) DEFAULT NULL COMMENT 'Kode ICD-9 (jika tindakan)',
    harga_pokok DECIMAL(10,2) DEFAULT 0,
    harga_jual DECIMAL(10,2) NOT NULL,
    diskon_maksimal DECIMAL(10,2) DEFAULT 0 COMMENT 'Diskon maksimal yang boleh diberikan',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_kategori (kategori),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: billings
CREATE TABLE billings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    encounter_id INT NOT NULL,
    patient_id INT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'Nomor invoice (INV-2026-00042)',
    subtotal DECIMAL(10,2) NOT NULL,
    total_discount DECIMAL(10,2) DEFAULT 0,
    grand_total DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    outstanding_amount DECIMAL(10,2) NOT NULL COMMENT 'Sisa tagihan',
    status ENUM('unpaid', 'partial', 'paid', 'cancelled', 'refunded') DEFAULT 'unpaid',
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_invoice_number (invoice_number),
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_encounter_id (encounter_id),
    INDEX idx_status (status),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: billing_items
CREATE TABLE billing_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    billing_id INT NOT NULL,
    tarif_id INT DEFAULT NULL COMMENT 'NULL jika custom item',
    name VARCHAR(100) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    discount_type ENUM('nominal', 'percent') DEFAULT 'nominal',
    subtotal DECIMAL(10,2) NOT NULL COMMENT 'Subtotal item (after discount)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_billing_id (billing_id),
    
    FOREIGN KEY (billing_id) REFERENCES billings(id) ON DELETE CASCADE,
    FOREIGN KEY (tarif_id) REFERENCES tarifs(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: payments
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    billing_id INT NOT NULL,
    receipt_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'Nomor kwitansi (RCP-2026-00042)',
    method ENUM('cash', 'transfer', 'insurance', 'bpjs') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    note TEXT DEFAULT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY idx_receipt_number (receipt_number),
    INDEX idx_billing_id (billing_id),
    
    FOREIGN KEY (billing_id) REFERENCES billings(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: refund_requests
CREATE TABLE refund_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    billing_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending_approval', 'approved', 'rejected', 'processed') DEFAULT 'pending_approval',
    approved_by INT DEFAULT NULL,
    approved_at TIMESTAMP NULL DEFAULT NULL,
    approval_note TEXT DEFAULT NULL,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_billing_id (billing_id),
    INDEX idx_status (status),
    
    FOREIGN KEY (billing_id) REFERENCES billings(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- TEMPLATES & SETTINGS TABLES
-- ==========================================

-- Table: soap_templates
CREATE TABLE soap_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    subjective TEXT DEFAULT NULL,
    objective TEXT DEFAULT NULL,
    assessment TEXT DEFAULT NULL,
    plan TEXT DEFAULT NULL,
    is_shared BOOLEAN DEFAULT FALSE COMMENT 'Shared ke semua dokter? (FALSE = personal)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_created_by (created_by),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- INTEGRATION TABLES
-- ==========================================

-- Table: satusehat_sync_logs
CREATE TABLE satusehat_sync_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clinic_id INT NOT NULL,
    resource_type VARCHAR(50) NOT NULL COMMENT 'Patient, Encounter, Condition, dll',
    local_id INT NOT NULL COMMENT 'ID lokal (patient_id, encounter_id, dll)',
    satusehat_id VARCHAR(100) DEFAULT NULL COMMENT 'ID resource di SATUSEHAT',
    operation ENUM('create', 'update', 'delete') NOT NULL,
    status ENUM('success', 'failed', 'pending') NOT NULL,
    http_status INT DEFAULT NULL COMMENT 'HTTP status code (200, 400, dll)',
    request_payload JSON DEFAULT NULL,
    response_payload JSON DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    retry_count INT DEFAULT 0,
    last_retry_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_clinic_id (clinic_id),
    INDEX idx_resource_local (resource_type, local_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- ADD MISSING FOREIGN KEY CONSTRAINTS
-- ==========================================

-- Add FK for users.created_by and users.updated_by (self-referencing)
-- Already defined in CREATE TABLE above

-- Add FK for clinics.created_by and clinics.updated_by
ALTER TABLE clinics
    ADD CONSTRAINT fk_clinics_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_clinics_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ==========================================
-- SAMPLE INITIAL DATA (Optional)
-- ==========================================

-- Insert initial owner code (untuk registrasi owner pertama)
-- Owner code: ABC12345 (bisa disesuaikan)

-- ==========================================
-- END OF DDL
-- ==========================================

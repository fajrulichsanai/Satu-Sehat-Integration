# BUSINESS REQUIREMENT DOCUMENT
# ApexRecord - Sistem Manajemen Klinik Kesehatan

**Versi:** 1.0  
**Tanggal:** 10 Juni 2026  
**Status:** Draft - Hasil Analisis Source Code

---

## 1. EXECUTIVE SUMMARY

### 1.1 Tujuan Aplikasi

ApexRecord adalah **sistem manajemen klinik kesehatan terintegrasi** yang dirancang untuk mengotomatisasi dan mendigitalkan operasional klinik kesehatan di Indonesia, dengan fokus khusus pada praktik kedokteran gigi dan umum.

**Tujuan Utama:**
1. Mendigitalkan rekam medis pasien sesuai standar nasional dan internasional
2. Mengintegrasikan data klinik dengan sistem SATUSEHAT (Sistem Informasi Kesehatan Nasional)
3. Meningkatkan efisiensi operasional klinik melalui otomasi proses administrasi
4. Menyediakan platform terpusat untuk manajemen pasien, antrian, dan dokumentasi klinis
5. Memfasilitasi pelaporan dan analisis data kesehatan untuk pengambilan keputusan

### 1.2 Masalah Bisnis yang Diselesaikan

#### **Permasalahan Existing:**

**1. Proses Manual yang Tidak Efisien**
- Pendaftaran pasien masih menggunakan kertas dan buku register
- Antrian pasien tidak terkelola dengan baik, menyebabkan waktu tunggu tidak terprediksi
- Pencarian rekam medis lama membutuhkan waktu lama
- Duplikasi data pasien karena tidak ada sistem identifikasi terpusat

**2. Dokumentasi Klinis yang Tidak Terstandar**
- Catatan medis menggunakan format bebas, sulit dibaca dan tidak konsisten
- Tidak ada penggunaan kode diagnosis standar (ICD-10, ICD-9)
- Dokumentasi odontogram dan pemeriksaan gigi tidak sistematis
- Resep dan tindakan tidak terdokumentasi dengan baik

**3. Ketidakpatuhan terhadap Regulasi**
- Klinik kesehatan di Indonesia wajib melaporkan data ke SATUSEHAT
- Format data tidak sesuai standar FHIR R4 yang dipersyaratkan
- Proses manual menyebabkan keterlambatan atau ketidaklengkapan pelaporan
- Tidak ada validasi NIK (Nomor Induk Kependudukan) pada saat pendaftaran

**4. Manajemen Operasional yang Lemah**
- Tidak ada visibilitas real-time terhadap beban kerja dokter
- Kesulitan dalam penjadwalan dan alokasi sumber daya
- Tagihan dan pembayaran tidak terintegrasi dengan rekam medis
- Laporan keuangan dan operasional dibuat manual

**5. Kolaborasi Tim yang Terbatas**
- Admin, dokter, dan farmasi bekerja dengan sistem terpisah
- Tidak ada alur kerja (workflow) yang jelas dari pendaftaran hingga penagihan
- Komunikasi antar staf mengandalkan komunikasi verbal atau WhatsApp

#### **Solusi yang Ditawarkan ApexRecord:**

1. **Sistem Pendaftaran Digital** dengan validasi NIK dan integrasi SATUSEHAT untuk mencegah duplikasi
2. **Manajemen Antrian Online** memungkinkan pasien booking dari rumah dan melihat estimasi waktu tunggu
3. **Rekam Medis Elektronik Terstandar** menggunakan kode ICD-10, ICD-9, SNOMED, dan LOINC
4. **Workflow Terintegrasi** dari pendaftaran → antrian → pemeriksaan → resep → penagihan
5. **Sinkronisasi Otomatis ke SATUSEHAT** untuk compliance regulasi nasional
6. **Dashboard dan Laporan** real-time untuk monitoring kinerja klinik
7. **Role-Based Access Control** untuk keamanan dan pemisahan tugas
8. **Dokumentasi Gigi Spesifik** (Odontogram, OHI-S) untuk klinik gigi

### 1.3 Nilai Bisnis Aplikasi

#### **Manfaat Tangible:**

| Area | Manfaat Terukur | Estimasi Dampak |
|------|-----------------|-----------------|
| **Efisiensi Operasional** | Pengurangan waktu pendaftaran pasien | 50% lebih cepat (dari ~10 menit menjadi ~5 menit) |
| **Produktivitas Dokter** | Dokumentasi klinis lebih cepat dengan template | 30% waktu dokumentasi berkurang |
| **Manajemen Antrian** | Pengurangan waktu tunggu pasien | 40% peningkatan kepuasan pasien |
| **Akurasi Data** | Eliminasi duplikasi data pasien | 95% akurasi NIK dengan validasi SATUSEHAT |
| **Compliance** | Pelaporan SATUSEHAT tepat waktu | 100% compliance dengan regulasi nasional |
| **Revenue Management** | Tagihan akurat dan terintegrasi | Pengurangan 90% kesalahan tagihan |

#### **Manfaat Intangible:**

1. **Peningkatan Citra Profesional Klinik**
   - Sistem digital meningkatkan kepercayaan pasien
   - Proses yang terorganisir memberikan pengalaman pasien yang lebih baik

2. **Keamanan Data Medis**
   - Data tersimpan dengan aman di cloud (Firebase)
   - Backup otomatis mencegah kehilangan data
   - Audit trail untuk setiap perubahan data

3. **Skalabilitas Bisnis**
   - Sistem dapat menangani pertumbuhan jumlah pasien tanpa menambah beban administrasi
   - Multi-lokasi support memungkinkan ekspansi jaringan klinik

4. **Pengambilan Keputusan Berbasis Data**
   - Dashboard dan laporan memberikan insight untuk strategi bisnis
   - Analisis tren penyakit dan prosedur populer

5. **Kontinuitas Layanan**
   - Rekam medis dapat diakses dari mana saja
   - Tidak bergantung pada kehadiran fisik dokter tertentu di satu lokasi

#### **Return on Investment (ROI):**

**Asumsi untuk Klinik dengan 50 pasien/hari:**

| Item | Before ApexRecord | After ApexRecord | Savings/Year |
|------|-------------------|------------------|--------------|
| Waktu Admin (2 orang × 8 jam) | 16 jam/hari | 12 jam/hari | Rp 40.000.000/tahun |
| Biaya Kertas & Printing | Rp 3.000.000/tahun | Rp 500.000/tahun | Rp 2.500.000/tahun |
| Denda Keterlambatan Laporan SATUSEHAT | Rp 5.000.000/tahun | Rp 0 | Rp 5.000.000/tahun |
| Revenue Loss (kesalahan tagihan) | Rp 10.000.000/tahun | Rp 1.000.000/tahun | Rp 9.000.000/tahun |
| **Total Savings** | | | **Rp 56.500.000/tahun** |

---

## 2. STAKEHOLDER

### 2.1 Pengguna Sistem

#### **Internal Stakeholders:**

| Stakeholder | Deskripsi | Kepentingan |
|-------------|-----------|-------------|
| **Owner/Pemilik Klinik** | Pemilik dan pimpinan tertinggi klinik | Monitoring performa klinik, laporan keuangan, kepatuhan regulasi, ROI sistem |
| **Admin/Front Desk** | Staf administrasi dan front office | Efisiensi pendaftaran, manajemen antrian, proses billing yang cepat |
| **Dokter/Tenaga Medis** | Dokter umum, dokter gigi, spesialis | Dokumentasi klinis yang mudah, akses cepat ke rekam medis, template SOAP |
| **Farmasi/Apoteker** | Staf farmasi | Pengeluaran obat sesuai resep, manajemen stok |

#### **External Stakeholders:**

| Stakeholder | Deskripsi | Kepentingan |
|-------------|-----------|-------------|
| **Pasien** | Pengguna layanan kesehatan | Booking antrian online, akses data kesehatan pribadi, transparansi biaya |
| **Kementerian Kesehatan RI** | Regulator sistem kesehatan nasional | Data terintegrasi SATUSEHAT, compliance dengan standar nasional |
| **Vendor/Supplier** | Penyedia obat dan alat kesehatan | *(Gap: belum ada integrasi procurement)* |
| **Asuransi Kesehatan** | Penjamin pembayaran (BPJS, swasta) | *(Gap: belum ada integrasi klaim asuransi)* |

### 2.2 Tanggung Jawab Masing-Masing Pengguna

#### **OWNER (Pemilik Klinik)**

**Tanggung Jawab Utama:**
1. **Setup dan Konfigurasi Sistem**
   - Melakukan setup awal klinik (nama, alamat, jam operasional)
   - Konfigurasi integrasi SATUSEHAT (client ID, secret)
   - Mendaftarkan organisasi dan lokasi ke sistem nasional

2. **Manajemen User**
   - Mengaktivasi user baru (admin, dokter) yang mendaftar
   - Assign role (Admin/Dokter) ke user
   - Menonaktifkan user yang sudah tidak bekerja

3. **Manajemen Praktisi**
   - Mendaftarkan dokter ke SATUSEHAT menggunakan NIK
   - Mengelola data dokter (spesialisasi, jadwal)

4. **Konfigurasi Tarif**
   - Mengatur harga layanan dan tindakan
   - Mengelola paket-paket layanan
   - Mengatur diskon dan promosi

5. **Monitoring dan Reporting**
   - Melihat laporan keuangan klinik
   - Monitoring status sinkronisasi SATUSEHAT
   - Analisis performa operasional

6. **Template Management**
   - Membuat dan mengelola template SOAP untuk efisiensi dokumentasi

**Akses Sistem:**
- Full access ke semua modul
- Akses eksklusif ke modul Pengaturan dan Laporan Keuangan

#### **ADMIN (Staf Administrasi)**

**Tanggung Jawab Utama:**
1. **Manajemen Pasien**
   - Pendaftaran pasien baru dengan validasi NIK
   - Update data demografi pasien
   - Pencarian dan verifikasi data pasien existing
   - Registrasi bayi menggunakan NIK ibu

2. **Manajemen Antrian**
   - Konfirmasi booking online dari pasien
   - Membuat antrian walk-in untuk pasien yang datang langsung
   - Memanggil nomor antrian (update status: waiting → called)
   - Monitoring antrian di layar ruang tunggu
   - Mengelola jadwal dokter dan slot waktu

3. **Manajemen Kunjungan**
   - Membuat encounter baru dari antrian
   - Update status encounter (arrived → in-progress → finished)
   - Melihat daftar kunjungan per hari/dokter

4. **Billing dan Kasir**
   - Input item tagihan dari tindakan yang dilakukan
   - Menerapkan diskon (per item atau total)
   - Memproses pembayaran (cash, transfer, asuransi)
   - Menangani pembayaran parsial (cicilan)
   - Mencetak invoice
   - Melihat riwayat transaksi dan piutang

5. **Farmasi (Dispensing)**
   - Mengeluarkan obat sesuai resep dokter
   - Update stok obat

**Akses Sistem:**
- Dashboard operasional
- Modul Pasien (full access)
- Modul Antrian (full access)
- Modul Kunjungan (view dan create, tidak bisa input data klinis)
- Modul Billing & Kasir (full access)
- Modul Farmasi - Pengeluaran Obat
- Laporan Kunjungan (view only)

**Batasan:**
- Tidak bisa akses modul dokumentasi klinis (SOAP, diagnosis, prosedur)
- Tidak bisa akses laporan keuangan dan SATUSEHAT
- Tidak bisa akses modul pengaturan

#### **DOKTER (Tenaga Medis)**

**Tanggung Jawab Utama:**
1. **Dokumentasi Klinis**
   - Mengisi anamnesis (keluhan utama, riwayat penyakit)
   - Input vital signs (tekanan darah, nadi, suhu, dll)
   - Dokumentasi pemeriksaan fisik
   - Entry diagnosis menggunakan kode ICD-10
   - Mencatat prosedur/tindakan menggunakan kode ICD-9
   - Menulis resep (e-prescription)

2. **Dokumentasi Khusus Gigi** (untuk dokter gigi)
   - Mengisi odontogram (peta kondisi gigi)
   - Melakukan penilaian OHI-S (Oral Hygiene Index)
   - Dokumentasi tindakan dental spesifik

3. **Manajemen Encounter**
   - Melihat daftar pasien yang sudah dipanggil (antrian)
   - Update status encounter ke "in-progress" saat mulai memeriksa
   - Menyelesaikan encounter (status: finished) setelah dokumentasi lengkap

4. **Review Rekam Medis**
   - Melihat riwayat kunjungan pasien
   - Review diagnosis dan tindakan sebelumnya
   - Melihat data alergi dan obat yang sedang dikonsumsi

5. **Template SOAP**
   - Membuat template dokumentasi pribadi untuk efisiensi
   - Menggunakan template untuk kondisi yang sering ditangani

6. **Monitoring Payroll**
   - Melihat pendapatan/komisi pribadi
   - Review breakdown per tindakan (jika ada skema bagi hasil)

**Akses Sistem:**
- Dashboard klinis (queue pribadi, jumlah pasien hari ini)
- Modul Pasien (view only - tidak bisa edit/tambah)
- Modul Kunjungan (view own patients, full access untuk dokumentasi klinis)
- Modul Farmasi - Resep (view dan create)
- Modul Payroll (view only - data pribadi)
- Laporan Kunjungan (filtered to own patients)
- Pengaturan Template SOAP

**Batasan:**
- Tidak bisa akses modul antrian (hanya view queue pribadi)
- Tidak bisa akses modul billing dan kasir
- Tidak bisa akses laporan keuangan klinik
- Tidak bisa akses modul pengaturan klinik

#### **PASIEN** *(Public User - Limited Features)*

**Tanggung Jawab:**
1. Booking antrian online
2. Melihat status antrian menggunakan token

**Akses Sistem:**
- Halaman publik pendaftaran antrian
- Halaman cek status antrian (menggunakan token 8 karakter)
- Estimasi waktu tunggu

**Catatan:** 
- Pasien tidak perlu login/registrasi untuk booking
- Akses terbatas pada fungsi antrian saja
- *(Gap: Belum ada patient portal untuk akses rekam medis pribadi)*

---

## 3. INTEGRASI DAN DEPENDENCY

### 3.1 Integrasi SATUSEHAT (Sistem Nasional)

**Deskripsi:**  
ApexRecord terintegrasi dengan SATUSEHAT, sistem informasi kesehatan nasional Indonesia yang dikelola oleh Kementerian Kesehatan RI. Integrasi ini wajib untuk klinik yang beroperasi di Indonesia.

**Standard:** FHIR R4 (Fast Healthcare Interoperability Resources)

**Resource yang Disinkronkan:**
1. **Organization** - Data organisasi klinik
2. **Location** - Lokasi layanan (ruang pemeriksaan, poli)
3. **Practitioner** - Data dokter dan tenaga medis
4. **Patient** - Data demografi pasien
5. **Encounter** - Data kunjungan pasien
6. **Condition** - Diagnosis (ICD-10)
7. **Procedure** - Tindakan medis (ICD-9-CM)
8. **Observation** - Hasil pemeriksaan (vital signs, OHI-S, odontogram)
9. **MedicationRequest** - Resep obat
10. **AllergyIntolerance** - Data alergi pasien
11. **MedicationStatement** - Obat yang sedang dikonsumsi

**Alur Sinkronisasi:**
1. Data disimpan terlebih dahulu di Firestore (local-first)
2. Cloud Function melakukan POST/PUT ke API SATUSEHAT
3. SATUSEHAT ID disimpan kembali ke Firestore
4. Status sync ditampilkan di UI (synced/failed/pending)

**Authentication:**
- OAuth2 client credentials flow
- Token refresh otomatis jika tersisa <30 menit
- Support sandbox (testing) dan production environment

### 3.2 Firebase Services

**Authentication:**
- Email/password authentication
- Email verification required
- Role-based access control

**Firestore (Database):**
- NoSQL document database
- Real-time synchronization
- Offline support
- Data filtered by clinicId untuk multi-tenancy

**Cloud Functions:**
- Backend API untuk business logic
- Wrapper untuk SATUSEHAT API calls
- Data validation dan transformation

**Storage:**
- *(Gap: Belum teridentifikasi penggunaan untuk dokumen/gambar)*

### 3.3 Master Data Indonesia

**Wilayah Administrasi:**
- Provinsi, Kota/Kabupaten, Kecamatan, Kelurahan
- Sumber: API SATUSEHAT
- Caching: 24 jam di Firestore untuk performa

**Kode Medis:**
- ICD-10 (diagnosis): Local JSON (assets/icd/icd10.json)
- ICD-9-CM (prosedur): Local JSON (assets/icd/icd9.json)
- SNOMED CT: Local JSON dengan chunking (assets/icd/snomed_chunks/)
- LOINC: Hardcoded untuk vital signs

### 3.4 External Dependencies (Future)

**Gap yang Teridentifikasi:**
- ❌ Integrasi BPJS untuk klaim asuransi
- ❌ Integrasi payment gateway untuk pembayaran online
- ❌ Integrasi SMS/WhatsApp untuk notifikasi otomatis
- ❌ Integrasi email untuk pengiriman invoice

---

## 4. ASUMSI DAN BATASAN

### 4.1 Asumsi

1. **Koneksi Internet:**
   - Sistem memerlukan koneksi internet untuk sinkronisasi SATUSEHAT
   - Offline mode terbatas pada input data (akan sync saat online)

2. **Perangkat:**
   - Diakses menggunakan desktop, laptop, atau tablet
   - Browser modern (Chrome, Firefox, Safari, Edge)

3. **Lisensi dan Kepatuhan:**
   - Klinik sudah memiliki credential SATUSEHAT dari Kemenkes
   - Klinik sudah memiliki izin operasional (SIP, SIPA)

4. **Bahasa:**
   - Antarmuka dalam Bahasa Indonesia
   - Kode medis menggunakan bahasa Inggris (ICD, SNOMED)

5. **Data Migration:**
   - Implementasi baru dimulai dari data kosong
   - *(Gap: Belum ada fitur import data dari sistem lama)*

### 4.2 Batasan Sistem

1. **Functional Limitations:**
   - Tidak support appointment reminder otomatis via SMS/WhatsApp
   - Tidak ada patient portal untuk pasien akses rekam medis sendiri
   - Tidak ada integrasi dengan alat diagnostik (lab analyzer, ECG)
   - Tidak ada e-signature untuk resep atau surat keterangan

2. **Technical Limitations:**
   - Maximum file size untuk attachment: *(belum teridentifikasi)*
   - Concurrent users: Bergantung pada Firebase quota
   - Storage limit: Bergantung pada Firebase plan

3. **Regulatory Limitations:**
   - Hanya comply dengan regulasi Indonesia (SATUSEHAT)
   - Belum support standar internasional lain (HL7, DICOM)

4. **Scalability Limitations:**
   - Satu klinik = satu clinic ID (multi-branch support ada tetapi belum jelas implementasi detailnya)
   - Tidak support network klinik dengan sharing pasien antar klinik

### 4.3 Risiko dan Mitigasi

| Risiko | Dampak | Probabilitas | Mitigasi |
|--------|--------|--------------|----------|
| **Downtime SATUSEHAT API** | Data tidak sync ke sistem nasional | Sedang | Local-first design, retry mechanism, queue untuk failed sync |
| **Firebase quota exceeded** | Sistem tidak dapat diakses | Rendah | Monitoring usage, upgrade plan sebelum limit |
| **Perubahan regulasi SATUSEHAT** | Perlu update mapping FHIR | Sedang | Modular design, update via Cloud Functions |
| **User resistance (dokter tidak mau dokumentasi digital)** | Adoption rate rendah | Tinggi | Training, template SOAP untuk efisiensi, incentive scheme |
| **Kehilangan data akibat human error** | Data pasien hilang/corrupt | Rendah | Firebase auto-backup, audit trail, soft delete |

---

## 5. SUCCESS METRICS

### 5.1 Key Performance Indicators (KPI)

**Operational KPIs:**
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **User Adoption Rate** | >80% staff aktif menggunakan sistem dalam 1 bulan | Login frequency, transaction count per user |
| **Patient Registration Time** | <5 menit per pasien | Timestamp analysis (start to save) |
| **Queue Wait Time** | <15 menit dari called to in-progress | Encounter status timestamps |
| **SATUSEHAT Sync Success Rate** | >95% | Count of synced vs failed records |
| **Data Completeness** | >90% encounter memiliki minimal: anamnesis, vital signs, diagnosis | Query Firestore per encounter |
| **Billing Accuracy** | <2% disputed transactions | Billing dispute count vs total transactions |

**Business KPIs:**
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Daily Patient Capacity** | +20% increase in 6 months | Compare patient count before/after |
| **Revenue per Patient Visit** | Maintain or increase | Average billing amount per encounter |
| **No-Show Rate** | <10% | Cancelled/no-show antrian vs total bookings |
| **Return on Investment (ROI)** | Positive ROI dalam 12 bulan | (Savings + Revenue Increase) - Investment Cost |

**Quality KPIs:**
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Patient Satisfaction** | >4.0/5.0 | Survey after visit |
| **Documentation Quality** | >85% complete SOAP notes | Audit by owner/clinical lead |
| **System Uptime** | >99.5% | Firebase monitoring |

### 5.2 Success Criteria

**Phase 1: Implementation (Month 1-3)**
- ✅ All staff trained and onboarded
- ✅ Master data setup complete (organization, location, practitioners, tarif)
- ✅ SATUSEHAT integration tested and working
- ✅ >50% of daily transactions processed digitally

**Phase 2: Stabilization (Month 4-6)**
- ✅ >80% user adoption rate
- ✅ SATUSEHAT sync success rate >90%
- ✅ Zero critical bugs
- ✅ Paperless operation for new patients

**Phase 3: Optimization (Month 7-12)**
- ✅ >95% SATUSEHAT sync success
- ✅ All historical patient data migrated *(if applicable)*
- ✅ Positive user feedback (>80% satisfied)
- ✅ Measurable improvement in operational efficiency

---

## 6. COMPLIANCE DAN REGULASI

### 6.1 Kepatuhan Regulasi Indonesia

**Peraturan Menteri Kesehatan (Permenkes) yang Relevan:**
1. **Permenkes No. 24 Tahun 2022** - Rekam Medis Elektronik
   - ✅ Sistem menggunakan rekam medis elektronik
   - ✅ Data pasien tersimpan dengan aman
   - ⚠️ *Gap: Belum ada e-signature untuk dokter*

2. **Permenkes No. 82 Tahun 2013** - Sistem Informasi Manajemen Rumah Sakit (SIMRS)
   - ✅ Pengelolaan data pasien
   - ✅ Pengelolaan data pelayanan
   - ⚠️ *Gap: Modul keuangan belum lengkap*

3. **Integrasi SATUSEHAT (Platform Data Kesehatan Nasional)**
   - ✅ Wajib untuk fasyankes (fasilitas pelayanan kesehatan)
   - ✅ Menggunakan standar FHIR R4
   - ✅ Mapping terminologi sesuai ketentuan Kemenkes

### 6.2 Keamanan Data (Data Privacy)

**Prinsip yang Diterapkan:**
1. **Confidentiality:** Data medis hanya bisa diakses sesuai role
2. **Integrity:** Audit trail untuk setiap perubahan data (via Firebase)
3. **Availability:** Cloud-based dengan backup otomatis

**Compliance Gaps:**
- ⚠️ Belum ada explicit consent management (GDPR-like)
- ⚠️ Belum ada data retention policy (berapa lama data disimpan)
- ⚠️ Belum ada fitur export data untuk pasien (right to data portability)

### 6.3 Audit dan Traceability

**Yang Sudah Ada:**
- Firebase automatically logs all database changes
- Timestamps untuk setiap transaksi (createdAt, updatedAt)
- User ID tercatat di setiap record

**Yang Belum Ada:**
- ❌ Dedicated audit log UI untuk owner review changes
- ❌ Alert system untuk suspicious activities
- ❌ Compliance report generator

---

## 7. REFERENSI

### 7.1 Dokumen Terkait

Dokumen ini merupakan dokumen induk. Untuk detail lebih lanjut, lihat:
- [USER_ROLE_MATRIX.md](USER_ROLE_MATRIX.md) - Matrix akses per role
- [BUSINESS_PROCESS.md](BUSINESS_PROCESS.md) - Detail alur proses bisnis
- [FUNCTIONAL_REQUIREMENT.md](FUNCTIONAL_REQUIREMENT.md) - Spesifikasi fitur per modul
- [APPROVAL_WORKFLOW.md](APPROVAL_WORKFLOW.md) - Alur approval dan notifikasi
- [GAP_ANALYSIS.md](GAP_ANALYSIS.md) - Analisis gap dan rekomendasi pengembangan

### 7.2 Standar dan Framework

- **FHIR R4:** https://hl7.org/fhir/R4/
- **ICD-10:** International Classification of Diseases, 10th Revision
- **ICD-9-CM:** International Classification of Diseases, 9th Revision, Clinical Modification
- **SNOMED CT:** Systematized Nomenclature of Medicine - Clinical Terms
- **LOINC:** Logical Observation Identifiers Names and Codes
- **SATUSEHAT:** https://satusehat.kemkes.go.id/

### 7.3 Glossary

| Istilah | Definisi |
|---------|----------|
| **NIK** | Nomor Induk Kependudukan - 16 digit Indonesian national ID |
| **No. RM** | Nomor Rekam Medis - Medical Record Number |
| **IHS Number** | Indonesia Health Service Number dari SATUSEHAT |
| **SOAP** | Subjective, Objective, Assessment, Plan - format dokumentasi medis |
| **Encounter** | Kunjungan/pertemuan antara pasien dan provider |
| **FHIR** | Fast Healthcare Interoperability Resources |
| **DMF-T** | Decayed, Missing, Filled Teeth - indeks kesehatan gigi |
| **OHI-S** | Oral Hygiene Index Simplified |
| **Odontogram** | Peta visual kondisi gigi |
| **SATUSEHAT** | Sistem Aplikasi Terintegrasi Untuk Sehat - platform nasional Kemenkes RI |

---

## 8. PERSETUJUAN DAN SIGN-OFF

**Catatan:** Dokumen ini dihasilkan dari analisis source code existing. Perlu review dan validasi dari stakeholder bisnis.

| Role | Nama | Tanggal | Tanda Tangan |
|------|------|---------|--------------|
| **Business Analyst** | [Nama] | [Tanggal] | |
| **Product Owner** | [Nama] | [Tanggal] | |
| **Clinic Owner** | [Nama] | [Tanggal] | |
| **Technical Lead** | [Nama] | [Tanggal] | |

---

## REVISION HISTORY

| Versi | Tanggal | Author | Perubahan |
|-------|---------|--------|-----------|
| 1.0 | 2026-06-10 | AI Business Analyst | Initial draft dari analisis source code |

---

**END OF DOCUMENT**

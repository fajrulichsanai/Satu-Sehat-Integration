# ApexRecord / ZanakCRM — DDL (v1.4)

> Database: **MySQL 8+** · Konvensi: `BIGINT` PK auto-increment, `DATETIME` UTC, soft-delete via `is_deleted`.

---

## Daftar Isi

1. [Auth & Users](#1-auth--users)
2. [Master Data](#2-master-data)
3. [Operational](#3-operational)
4. [Engagement](#4-engagement)
5. [Analytics](#5-analytics)
6. [Finance & Inventory](#6-finance--inventory)

---

## 1. Auth & Users

### `roles`
```sql
CREATE TABLE roles (
    id        BIGINT       NOT NULL AUTO_INCREMENT,
    name      VARCHAR(50)  NOT NULL COMMENT 'owner|admin|doctor',
    label     VARCHAR(100) NOT NULL,
    is_active BOOLEAN      NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
);
```

### `clinics`
```sql
CREATE TABLE clinics (
    id          BIGINT         NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150)   NOT NULL,
    code        VARCHAR(30)    NOT NULL,
    tax_percent DECIMAL(5,2)   NOT NULL DEFAULT 0.00 COMMENT 'Default for new transactions',
    open_time   TIME           NOT NULL,
    close_time  TIME           NOT NULL,
    is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
    is_deleted  BOOLEAN        NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_clinics_code (code)
);
```

### `users`
```sql
CREATE TABLE users (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    clinic_id            BIGINT       NULL COMMENT 'NULL = owner all-branch',
    role_id              BIGINT       NOT NULL,
    name                 VARCHAR(150) NOT NULL,
    email                VARCHAR(255) NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    email_verified       BOOLEAN      NOT NULL DEFAULT FALSE,
    email_verify_token   VARCHAR(255) NULL,
    status               ENUM('pending','invited','active','inactive') NOT NULL DEFAULT 'pending',
    invite_token         VARCHAR(255) NULL,
    invited_by           BIGINT       NULL,
    is_deleted           BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    CONSTRAINT fk_users_clinic   FOREIGN KEY (clinic_id)  REFERENCES clinics (id),
    CONSTRAINT fk_users_role     FOREIGN KEY (role_id)    REFERENCES roles   (id),
    CONSTRAINT fk_users_inviter  FOREIGN KEY (invited_by) REFERENCES users   (id)
);
```

### `owner_codes`
```sql
CREATE TABLE owner_codes (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    code       VARCHAR(100) NOT NULL,
    is_used    BOOLEAN      NOT NULL DEFAULT FALSE,
    used_by    BIGINT       NULL,
    expires_at DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_owner_codes_code (code),
    CONSTRAINT fk_owner_codes_user FOREIGN KEY (used_by) REFERENCES users (id)
);
```

### `user_sessions`
```sql
CREATE TABLE user_sessions (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    user_id             BIGINT       NOT NULL,
    refresh_token_hash  VARCHAR(255) NOT NULL,
    ip_address          VARCHAR(45)  NULL,
    user_agent          VARCHAR(512) NULL,
    expires_at          DATETIME     NOT NULL,
    is_revoked          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
);
```

### `user_activity_log`
```sql
CREATE TABLE user_activity_log (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    user_id      BIGINT       NOT NULL,
    clinic_id    BIGINT       NOT NULL,
    action       VARCHAR(100) NOT NULL COMMENT 'login|assign_role|void_trx|...',
    entity_type  VARCHAR(100) NULL,
    entity_id    BIGINT       NULL,
    before_value JSON         NULL,
    after_value  JSON         NULL,
    ip_address   VARCHAR(45)  NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_ual_user   FOREIGN KEY (user_id)   REFERENCES users   (id),
    CONSTRAINT fk_ual_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);
```

### `doctor_profiles`
```sql
CREATE TABLE doctor_profiles (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    user_id         BIGINT       NOT NULL COMMENT 'role = doctor',
    specialization  VARCHAR(150) NULL,
    license_number  VARCHAR(100) NULL,
    license_expiry  DATE         NULL,
    join_date       DATE         NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_doctor_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
);
```

### `doctor_schedules`
```sql
CREATE TABLE doctor_schedules (
    id          BIGINT   NOT NULL AUTO_INCREMENT,
    doctor_id   BIGINT   NOT NULL,
    clinic_id   BIGINT   NOT NULL,
    day_of_week TINYINT  NOT NULL COMMENT '0=Sun … 6=Sat',
    start_time  TIME     NOT NULL,
    end_time    TIME     NOT NULL,
    is_active   BOOLEAN  NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    CONSTRAINT fk_ds_doctor FOREIGN KEY (doctor_id) REFERENCES users   (id),
    CONSTRAINT fk_ds_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);
```

---

## 2. Master Data

### `patients`
```sql
CREATE TABLE patients (
    id                  BIGINT         NOT NULL AUTO_INCREMENT,
    clinic_id           BIGINT         NOT NULL,
    no_rm               VARCHAR(50)    NOT NULL COMMENT 'Unique per clinic',
    name                VARCHAR(150)   NOT NULL,
    birth_date          DATE           NULL,
    gender              ENUM('L','P')  NULL,
    phone               VARCHAR(30)    NULL,
    kecamatan           VARCHAR(100)   NULL,
    city                VARCHAR(100)   NULL,
    sumber_informasi    ENUM('google','instagram','tiktok','referral','walk_in','lainnya') NULL,
    referrer_patient_id BIGINT         NULL,
    consent_marketing   BOOLEAN        NOT NULL DEFAULT FALSE,
    dokter_favorit_id   BIGINT         NULL,
    recency_days        SMALLINT       NULL COMMENT 'RFM cache',
    frequency           SMALLINT       NULL COMMENT 'RFM cache',
    monetary            DECIMAL(15,2)  NULL COMMENT 'RFM cache',
    rfm_score           VARCHAR(10)    NULL COMMENT 'RFM cache',
    segment             ENUM('champion','loyal','at_risk','hibernating','lost','new','lainnya') NULL COMMENT 'RFM cache',
    churn_risk          ENUM('low','medium','high') NULL COMMENT 'RFM cache',
    is_deleted          BOOLEAN        NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_patients_rm (clinic_id, no_rm),
    CONSTRAINT fk_patients_clinic    FOREIGN KEY (clinic_id)           REFERENCES clinics  (id),
    CONSTRAINT fk_patients_referrer  FOREIGN KEY (referrer_patient_id) REFERENCES patients (id),
    CONSTRAINT fk_patients_fav_doc   FOREIGN KEY (dokter_favorit_id)   REFERENCES users    (id)
);
```

### `patient_contact_history`
```sql
CREATE TABLE patient_contact_history (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    patient_id BIGINT       NOT NULL,
    field_name ENUM('phone','email') NOT NULL,
    old_value  VARCHAR(255) NULL,
    new_value  VARCHAR(255) NULL,
    changed_by BIGINT       NOT NULL,
    changed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_pch_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_pch_user    FOREIGN KEY (changed_by) REFERENCES users    (id)
);
```

### `patient_consent_history`
```sql
CREATE TABLE patient_consent_history (
    id                BIGINT   NOT NULL AUTO_INCREMENT,
    patient_id        BIGINT   NOT NULL,
    consent_marketing BOOLEAN  NOT NULL,
    reason            ENUM('user_request','admin_override','import','lainnya') NULL,
    changed_by        BIGINT   NOT NULL,
    changed_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_pcoh_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
    CONSTRAINT fk_pcoh_user    FOREIGN KEY (changed_by) REFERENCES users    (id)
);
```

### `service_categories`
```sql
CREATE TABLE service_categories (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    clinic_id  BIGINT      NULL COMMENT 'NULL = global/shared',
    name       VARCHAR(100) NOT NULL,
    sort_order SMALLINT    NOT NULL DEFAULT 0,
    is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_scat_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);
```

### `services`
```sql
CREATE TABLE services (
    id                   BIGINT         NOT NULL AUTO_INCREMENT,
    clinic_id            BIGINT         NOT NULL,
    category_id          BIGINT         NOT NULL,
    name                 VARCHAR(150)   NOT NULL,
    code                 VARCHAR(50)    NOT NULL COMMENT 'Unique per clinic',
    item_type            ENUM('layanan','produk') NOT NULL,
    price                DECIMAL(15,2)  NOT NULL DEFAULT 0.00 COMMENT 'Active sell price',
    cost_price           DECIMAL(15,2)  NOT NULL DEFAULT 0.00 COMMENT 'Fallback HPP',
    duration_minutes     SMALLINT       NULL,
    interval_recall_days SMALLINT       NULL COMMENT 'Reminder engine',
    is_active            BOOLEAN        NOT NULL DEFAULT TRUE,
    is_deleted           BOOLEAN        NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_services_code (clinic_id, code),
    CONSTRAINT fk_svc_clinic   FOREIGN KEY (clinic_id)   REFERENCES clinics             (id),
    CONSTRAINT fk_svc_category FOREIGN KEY (category_id) REFERENCES service_categories  (id)
);
```

### `service_price_history`
```sql
CREATE TABLE service_price_history (
    id           BIGINT         NOT NULL AUTO_INCREMENT,
    service_id   BIGINT         NOT NULL,
    old_price    DECIMAL(15,2)  NOT NULL,
    new_price    DECIMAL(15,2)  NOT NULL,
    old_cost     DECIMAL(15,2)  NOT NULL,
    new_cost     DECIMAL(15,2)  NOT NULL,
    reason       VARCHAR(255)   NULL,
    changed_by   BIGINT         NOT NULL,
    effective_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_sph_service FOREIGN KEY (service_id) REFERENCES services (id),
    CONSTRAINT fk_sph_user    FOREIGN KEY (changed_by) REFERENCES users    (id)
);
```

---

## 3. Operational

### `appointments`
```sql
CREATE TABLE appointments (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    clinic_id          BIGINT       NOT NULL,
    patient_id         BIGINT       NULL COMMENT 'NULL = guest',
    guest_name         VARCHAR(150) NULL,
    guest_phone        VARCHAR(30)  NULL,
    doctor_id          BIGINT       NULL,
    service_id         BIGINT       NULL,
    scheduled_at       DATETIME     NOT NULL,
    booking_source     ENUM('walk_in','whatsapp','instagram','tiktok','website','lainnya') NOT NULL,
    status             ENUM('pending','confirmed','cancelled','no_show','converted') NOT NULL DEFAULT 'pending',
    converted_visit_id BIGINT       NULL,
    is_deleted         BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_appt_clinic   FOREIGN KEY (clinic_id)  REFERENCES clinics   (id),
    CONSTRAINT fk_appt_patient  FOREIGN KEY (patient_id) REFERENCES patients  (id),
    CONSTRAINT fk_appt_doctor   FOREIGN KEY (doctor_id)  REFERENCES users     (id),
    CONSTRAINT fk_appt_service  FOREIGN KEY (service_id) REFERENCES services  (id)
);
```

### `visits`
```sql
CREATE TABLE visits (
    id                BIGINT   NOT NULL AUTO_INCREMENT,
    clinic_id         BIGINT   NOT NULL,
    patient_id        BIGINT   NOT NULL,
    appointment_id    BIGINT   NULL COMMENT 'NULL = walk-in',
    doctor_id         BIGINT   NULL,
    check_in_at       DATETIME NOT NULL,
    check_out_at      DATETIME NULL,
    visit_type        ENUM('baru','ulang') NOT NULL,
    booking_source    ENUM('walk_in','whatsapp','instagram','tiktok','website','lainnya') NOT NULL,
    followup_id       BIGINT   NULL COMMENT 'ROI link ke followups.id',
    service_target_id BIGINT   NULL,
    visit_status      ENUM('in_progress','done','cancelled') NOT NULL DEFAULT 'in_progress',
    is_deleted        BOOLEAN  NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_visit_clinic      FOREIGN KEY (clinic_id)         REFERENCES clinics      (id),
    CONSTRAINT fk_visit_patient     FOREIGN KEY (patient_id)        REFERENCES patients     (id),
    CONSTRAINT fk_visit_appt        FOREIGN KEY (appointment_id)    REFERENCES appointments (id),
    CONSTRAINT fk_visit_doctor      FOREIGN KEY (doctor_id)         REFERENCES users        (id),
    CONSTRAINT fk_visit_svc_target  FOREIGN KEY (service_target_id) REFERENCES services     (id)
);
```

### `transactions`
```sql
CREATE TABLE transactions (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id       BIGINT        NOT NULL,
    invoice_number  VARCHAR(50)   NOT NULL COMMENT 'Unique per clinic',
    patient_id      BIGINT        NOT NULL,
    visit_id        BIGINT        NULL,
    transaction_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    discount_total  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tax_percent     DECIMAL(5,2)  NOT NULL DEFAULT 0.00 COMMENT 'Snapshot saat transaksi',
    tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    grand_total     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    paid_total      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    payment_status  ENUM('lunas','dp','belum_bayar') NOT NULL DEFAULT 'belum_bayar',
    cashier_id      BIGINT        NULL,
    campaign_id     BIGINT        NULL,
    is_deleted      BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_trx_invoice (clinic_id, invoice_number),
    CONSTRAINT fk_trx_clinic   FOREIGN KEY (clinic_id)  REFERENCES clinics   (id),
    CONSTRAINT fk_trx_patient  FOREIGN KEY (patient_id) REFERENCES patients  (id),
    CONSTRAINT fk_trx_visit    FOREIGN KEY (visit_id)   REFERENCES visits    (id),
    CONSTRAINT fk_trx_cashier  FOREIGN KEY (cashier_id) REFERENCES users     (id)
);
```

### `transaction_items`
```sql
CREATE TABLE transaction_items (
    id             BIGINT         NOT NULL AUTO_INCREMENT,
    transaction_id BIGINT         NOT NULL,
    service_id     BIGINT         NULL COMMENT 'Reference nullable (snapshot)',
    item_name      VARCHAR(150)   NOT NULL COMMENT 'SNAPSHOT nama saat transaksi',
    item_type      ENUM('layanan','produk') NOT NULL,
    category_name  VARCHAR(100)   NULL COMMENT 'Snapshot',
    qty            SMALLINT       NOT NULL DEFAULT 1,
    unit_price     DECIMAL(15,2)  NOT NULL COMMENT 'SNAPSHOT harga saat transaksi',
    unit_cost      DECIMAL(15,2)  NOT NULL DEFAULT 0.00 COMMENT 'COGS = bahan + fee',
    discount_item  DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
    subtotal       DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
    performer_id   BIGINT         NULL COMMENT 'Doctor / therapist yang melakukan',
    PRIMARY KEY (id),
    CONSTRAINT fk_ti_transaction FOREIGN KEY (transaction_id) REFERENCES transactions (id),
    CONSTRAINT fk_ti_service     FOREIGN KEY (service_id)     REFERENCES services     (id),
    CONSTRAINT fk_ti_performer   FOREIGN KEY (performer_id)   REFERENCES users        (id)
);
```

### `transaction_payments`
```sql
CREATE TABLE transaction_payments (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    transaction_id BIGINT        NOT NULL,
    amount         DECIMAL(15,2) NOT NULL,
    method         ENUM('tunai','qris','debit','kredit','transfer') NOT NULL,
    reference_no   VARCHAR(100)  NULL,
    paid_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_by    BIGINT        NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_tp_transaction FOREIGN KEY (transaction_id) REFERENCES transactions (id),
    CONSTRAINT fk_tp_user        FOREIGN KEY (received_by)    REFERENCES users        (id)
);
```

### `expenses`
```sql
CREATE TABLE expenses (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id    BIGINT        NOT NULL,
    expense_date DATE          NOT NULL,
    category     ENUM('marketing','operasional','gaji','sewa','utilitas','lainnya') NOT NULL COMMENT 'Non-recurring only',
    sub_category VARCHAR(100)  NULL COMMENT 'Required if category = marketing',
    campaign_id  BIGINT        NULL,
    amount       DECIMAL(15,2) NOT NULL,
    receipt_url  VARCHAR(512)  NULL,
    is_deleted   BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_exp_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);
```

---

## 4. Engagement

### `campaigns`
```sql
CREATE TABLE campaigns (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id      BIGINT        NOT NULL,
    name           VARCHAR(150)  NOT NULL,
    channel        ENUM('whatsapp','instagram','tiktok','email','offline','lainnya') NOT NULL,
    start_date     DATE          NOT NULL,
    end_date       DATE          NULL,
    budget         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    promo_code     VARCHAR(50)   NULL,
    target_segment ENUM('all','champion','loyal','at_risk','hibernating','lost','new') NULL,
    status         ENUM('draft','active','paused','ended') NOT NULL DEFAULT 'draft',
    is_deleted     BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_camp_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);

-- FK balik dari transactions & expenses ke campaigns (ditambah setelah campaign dibuat):
ALTER TABLE transactions ADD CONSTRAINT fk_trx_campaign  FOREIGN KEY (campaign_id) REFERENCES campaigns (id);
ALTER TABLE expenses      ADD CONSTRAINT fk_exp_campaign  FOREIGN KEY (campaign_id) REFERENCES campaigns (id);
```

### `followup_templates`
```sql
CREATE TABLE followup_templates (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    clinic_id     BIGINT       NULL COMMENT 'NULL = global/shared',
    name          VARCHAR(150) NOT NULL,
    followup_type ENUM('recall','birthday','campaign','manual') NOT NULL,
    channel       ENUM('whatsapp','instagram','sms','email') NOT NULL,
    content       TEXT         NOT NULL,
    variant_label VARCHAR(10)  NULL COMMENT 'A/B label',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_ft_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);
```

### `followups`
```sql
CREATE TABLE followups (
    id              BIGINT   NOT NULL AUTO_INCREMENT,
    clinic_id       BIGINT   NOT NULL,
    patient_id      BIGINT   NOT NULL,
    template_id     BIGINT   NOT NULL,
    campaign_id     BIGINT   NULL,
    followup_type   ENUM('recall','birthday','campaign','manual') NOT NULL,
    channel         ENUM('whatsapp','instagram','sms','email') NOT NULL,
    scheduled_at    DATETIME NOT NULL,
    sent_at         DATETIME NULL,
    send_status     ENUM('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
    result          ENUM('booking','tertarik','tidak','stop') NULL,
    result_visit_id BIGINT   NULL,
    staff_id        BIGINT   NULL,
    is_deleted      BOOLEAN  NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_fu_clinic    FOREIGN KEY (clinic_id)       REFERENCES clinics             (id),
    CONSTRAINT fk_fu_patient   FOREIGN KEY (patient_id)      REFERENCES patients            (id),
    CONSTRAINT fk_fu_template  FOREIGN KEY (template_id)     REFERENCES followup_templates  (id),
    CONSTRAINT fk_fu_campaign  FOREIGN KEY (campaign_id)     REFERENCES campaigns           (id),
    CONSTRAINT fk_fu_visit     FOREIGN KEY (result_visit_id) REFERENCES visits              (id),
    CONSTRAINT fk_fu_staff     FOREIGN KEY (staff_id)        REFERENCES users               (id)
);
```

---

## 5. Analytics

### `rfm_snapshots`
```sql
CREATE TABLE rfm_snapshots (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id     BIGINT        NOT NULL,
    patient_id    BIGINT        NOT NULL,
    snapshot_date DATE          NOT NULL COMMENT 'Unique per patient per day',
    recency_days  SMALLINT      NOT NULL,
    frequency     SMALLINT      NOT NULL,
    monetary      DECIMAL(15,2) NOT NULL,
    r_score       TINYINT       NOT NULL,
    f_score       TINYINT       NOT NULL,
    m_score       TINYINT       NOT NULL,
    rfm_score     VARCHAR(10)   NOT NULL,
    segment       ENUM('champion','loyal','at_risk','hibernating','lost','new','lainnya') NOT NULL,
    clv_estimate  DECIMAL(15,2) NULL,
    churn_risk    ENUM('low','medium','high') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rfm_patient_date (patient_id, snapshot_date),
    CONSTRAINT fk_rfm_clinic   FOREIGN KEY (clinic_id)  REFERENCES clinics  (id),
    CONSTRAINT fk_rfm_patient  FOREIGN KEY (patient_id) REFERENCES patients (id)
);
```

---

## 6. Finance & Inventory

### `inventory_items`
```sql
CREATE TABLE inventory_items (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id        BIGINT        NOT NULL,
    name             VARCHAR(150)  NOT NULL,
    code             VARCHAR(50)   NULL,
    category         ENUM('bahan_baku','alat','produk_jual','lainnya') NOT NULL,
    unit             VARCHAR(20)   NOT NULL,
    current_stock    DECIMAL(12,3) NOT NULL DEFAULT 0.000 COMMENT 'Single source of truth',
    wac_cost         DECIMAL(15,4) NOT NULL DEFAULT 0.0000 COMMENT 'Weighted average cost',
    inventory_method ENUM('wac','fifo') NOT NULL DEFAULT 'wac',
    reorder_point    DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    is_expirable     BOOLEAN       NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
    is_deleted       BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_inv_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);
```

### `inventory_movements`
```sql
CREATE TABLE inventory_movements (
    id                BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id         BIGINT        NOT NULL,
    inventory_item_id BIGINT        NOT NULL,
    movement_type     ENUM('pembelian','pemakaian','penyesuaian','retur','kadaluarsa') NOT NULL,
    qty               DECIMAL(12,3) NOT NULL COMMENT 'Positif = masuk, negatif = keluar',
    unit_cost         DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    total_cost        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    stock_after       DECIMAL(12,3) NOT NULL COMMENT 'Snapshot stok setelah movement',
    wac_after         DECIMAL(15,4) NOT NULL COMMENT 'Snapshot WAC setelah movement',
    reference_type    ENUM('purchase','transaction','adjustment','lainnya') NULL,
    reference_id      BIGINT        NULL COMMENT 'e.g. transaction_id / purchase_id',
    batch_no          VARCHAR(100)  NULL,
    expiry_date       DATE          NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_im_clinic FOREIGN KEY (clinic_id)         REFERENCES clinics          (id),
    CONSTRAINT fk_im_item   FOREIGN KEY (inventory_item_id) REFERENCES inventory_items  (id)
);
```

### `inventory_purchases`
```sql
CREATE TABLE inventory_purchases (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id      BIGINT        NOT NULL,
    purchase_no    VARCHAR(50)   NOT NULL COMMENT 'Unique per clinic',
    supplier_name  VARCHAR(150)  NOT NULL,
    purchase_date  DATE          NOT NULL,
    total_amount   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('lunas','tempo','sebagian') NOT NULL DEFAULT 'tempo',
    paid_amount    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    due_date       DATE          NULL COMMENT 'Supplier payable due date',
    is_deleted     BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_inv_purchase_no (clinic_id, purchase_no),
    CONSTRAINT fk_ip_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);
```

### `inventory_purchase_items`
```sql
CREATE TABLE inventory_purchase_items (
    id                BIGINT        NOT NULL AUTO_INCREMENT,
    purchase_id       BIGINT        NOT NULL,
    inventory_item_id BIGINT        NOT NULL,
    qty               DECIMAL(12,3) NOT NULL,
    unit_cost         DECIMAL(15,4) NOT NULL,
    subtotal          DECIMAL(15,2) NOT NULL,
    batch_no          VARCHAR(100)  NULL,
    expiry_date       DATE          NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_ipi_purchase FOREIGN KEY (purchase_id)       REFERENCES inventory_purchases (id),
    CONSTRAINT fk_ipi_item     FOREIGN KEY (inventory_item_id) REFERENCES inventory_items     (id)
);
```

### `service_bom`
```sql
CREATE TABLE service_bom (
    id                BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id         BIGINT        NOT NULL,
    service_id        BIGINT        NOT NULL,
    inventory_item_id BIGINT        NOT NULL,
    qty_standard      DECIMAL(12,3) NOT NULL COMMENT 'Unique per service + item',
    is_optional       BOOLEAN       NOT NULL DEFAULT FALSE,
    is_deleted        BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bom_svc_item (service_id, inventory_item_id),
    CONSTRAINT fk_bom_clinic  FOREIGN KEY (clinic_id)         REFERENCES clinics         (id),
    CONSTRAINT fk_bom_service FOREIGN KEY (service_id)        REFERENCES services        (id),
    CONSTRAINT fk_bom_item    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id)
);
```

### `doctor_payment_rules`
```sql
CREATE TABLE doctor_payment_rules (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id          BIGINT        NOT NULL,
    doctor_id          BIGINT        NOT NULL,
    payment_scheme     ENUM('pct','fixed','salary','mixed') NOT NULL,
    base_salary        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    default_percentage DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
    default_fixed_fee  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    service_id         BIGINT        NULL COMMENT 'Override per service',
    category_id        BIGINT        NULL COMMENT 'Override per category',
    effective_from     DATE          NOT NULL,
    effective_to       DATE          NULL,
    is_active          BOOLEAN       NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    CONSTRAINT fk_dpr_clinic    FOREIGN KEY (clinic_id)   REFERENCES clinics             (id),
    CONSTRAINT fk_dpr_doctor    FOREIGN KEY (doctor_id)   REFERENCES users               (id),
    CONSTRAINT fk_dpr_service   FOREIGN KEY (service_id)  REFERENCES services            (id),
    CONSTRAINT fk_dpr_category  FOREIGN KEY (category_id) REFERENCES service_categories  (id)
);
```

### `payroll_runs`
```sql
CREATE TABLE payroll_runs (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id     BIGINT        NOT NULL,
    doctor_id     BIGINT        NOT NULL,
    period_yyyymm CHAR(6)       NOT NULL COMMENT 'Unique per clinic + doctor + period',
    base_salary   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_fee     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    deductions    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    net_pay       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status        ENUM('draft','final','dibayar') NOT NULL DEFAULT 'draft',
    paid_at       DATETIME      NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payroll_period (clinic_id, doctor_id, period_yyyymm),
    CONSTRAINT fk_pr_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id),
    CONSTRAINT fk_pr_doctor FOREIGN KEY (doctor_id) REFERENCES users   (id)
);
```

### `doctor_fee_entries`
```sql
CREATE TABLE doctor_fee_entries (
    id                  BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id           BIGINT        NOT NULL,
    doctor_id           BIGINT        NOT NULL,
    transaction_item_id BIGINT        NOT NULL COMMENT 'JOIN untuk detail trx & service',
    fee_amount          DECIMAL(15,2) NOT NULL,
    period_yyyymm       CHAR(6)       NOT NULL,
    is_paid             BOOLEAN       NOT NULL DEFAULT FALSE,
    payroll_run_id      BIGINT        NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_dfe_clinic  FOREIGN KEY (clinic_id)           REFERENCES clinics           (id),
    CONSTRAINT fk_dfe_doctor  FOREIGN KEY (doctor_id)           REFERENCES users             (id),
    CONSTRAINT fk_dfe_ti      FOREIGN KEY (transaction_item_id) REFERENCES transaction_items (id),
    CONSTRAINT fk_dfe_payroll FOREIGN KEY (payroll_run_id)      REFERENCES payroll_runs      (id)
);
```

### `fixed_cost_config`
```sql
CREATE TABLE fixed_cost_config (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    clinic_id      BIGINT        NOT NULL,
    cost_name      VARCHAR(150)  NOT NULL,
    category       ENUM('sewa','gaji','utilitas','asuransi','lainnya') NOT NULL,
    monthly_amount DECIMAL(15,2) NOT NULL,
    effective_from DATE          NOT NULL,
    effective_to   DATE          NULL,
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    CONSTRAINT fk_fcc_clinic FOREIGN KEY (clinic_id) REFERENCES clinics (id)
);
```

---

## Ringkasan Tabel

| No | Tabel | Grup |
|----|-------|------|
| 1 | `roles` | Auth & Users |
| 2 | `clinics` | Auth & Users |
| 3 | `users` | Auth & Users |
| 4 | `owner_codes` | Auth & Users |
| 5 | `user_sessions` | Auth & Users |
| 6 | `user_activity_log` | Auth & Users |
| 7 | `doctor_profiles` | Auth & Users |
| 8 | `doctor_schedules` | Auth & Users |
| 9 | `patients` | Master Data |
| 10 | `patient_contact_history` | Master Data |
| 11 | `patient_consent_history` | Master Data |
| 12 | `service_categories` | Master Data |
| 13 | `services` | Master Data |
| 14 | `service_price_history` | Master Data |
| 15 | `appointments` | Operational |
| 16 | `visits` | Operational |
| 17 | `transactions` | Operational |
| 18 | `transaction_items` | Operational |
| 19 | `transaction_payments` | Operational |
| 20 | `expenses` | Operational |
| 21 | `campaigns` | Engagement |
| 22 | `followup_templates` | Engagement |
| 23 | `followups` | Engagement |
| 24 | `rfm_snapshots` | Analytics |
| 25 | `inventory_items` | Finance & Inventory |
| 26 | `inventory_movements` | Finance & Inventory |
| 27 | `inventory_purchases` | Finance & Inventory |
| 28 | `inventory_purchase_items` | Finance & Inventory |
| 29 | `service_bom` | Finance & Inventory |
| 30 | `doctor_payment_rules` | Finance & Inventory |
| 31 | `payroll_runs` | Finance & Inventory |
| 32 | `doctor_fee_entries` | Finance & Inventory |
| 33 | `fixed_cost_config` | Finance & Inventory |

---

> **Catatan Implementasi:**
> - Semua tabel menggunakan `ENGINE=InnoDB` dan `CHARSET=utf8mb4` saat eksekusi di MySQL.
> - Urutan eksekusi DDL: `roles` → `clinics` → `users` → lalu grup lainnya sesuai urutan di atas (ikuti dependency FK).
> - Tabel `campaigns` perlu dibuat **sebelum** `transactions` dan `expenses` jika FK campaign ingin langsung disertakan, atau gunakan `ALTER TABLE` seperti pada contoh di atas.
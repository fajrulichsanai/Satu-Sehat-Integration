# NestJS Entity Classes with TypeORM
## ApexRecord - Complete Entity Definitions

**Generated:** 2026-06-11  
**Framework:** NestJS + TypeORM  
**Database:** MySQL 8.0+

---

## Directory Structure

```
src/
├── entities/
│   ├── core/
│   │   ├── clinic.entity.ts
│   │   ├── user.entity.ts
│   │   ├── practitioner.entity.ts
│   │   └── location.entity.ts
│   ├── patient/
│   │   ├── patient.entity.ts
│   │   └── queue.entity.ts
│   ├── clinical/
│   │   ├── encounter.entity.ts
│   │   ├── anamnesis.entity.ts
│   │   ├── allergy.entity.ts
│   │   ├── medication-history.entity.ts
│   │   ├── vital-sign.entity.ts
│   │   ├── diagnosis.entity.ts
│   │   ├── procedure.entity.ts
│   │   ├── odontogram-data.entity.ts
│   │   └── ohis-data.entity.ts
│   ├── pharmacy/
│   │   ├── medication.entity.ts
│   │   ├── prescription.entity.ts
│   │   ├── dispense.entity.ts
│   │   └── medication-stock-log.entity.ts
│   ├── billing/
│   │   ├── tarif.entity.ts
│   │   ├── billing.entity.ts
│   │   ├── billing-item.entity.ts
│   │   ├── payment.entity.ts
│   │   └── refund-request.entity.ts
│   ├── settings/
│   │   └── soap-template.entity.ts
│   └── integration/
│       └── satusehat-sync-log.entity.ts
└── common/
    ├── enums/
    │   ├── user-role.enum.ts
    │   ├── sync-status.enum.ts
    │   ├── encounter-status.enum.ts
    │   └── ... (other enums)
    └── base/
        └── base.entity.ts
```

---

## Base Entity (Abstract)

### **src/common/base/base.entity.ts**

```typescript
import { 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Column 
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: number;
}
```

---

## Enums

### **src/common/enums/user-role.enum.ts**

```typescript
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  DOKTER = 'dokter',
  PENDING = 'pending',
}
```

### **src/common/enums/sync-status.enum.ts**

```typescript
export enum SyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed',
}
```

### **src/common/enums/encounter-status.enum.ts**

```typescript
export enum EncounterStatus {
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}
```

### **src/common/enums/gender.enum.ts**

```typescript
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}
```

---

## Core Entities

### **src/entities/core/clinic.entity.ts**

```typescript
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { User } from './user.entity';
import { Practitioner } from './practitioner.entity';
import { Location } from './location.entity';
import { Patient } from '../patient/patient.entity';

export enum SatusehatEnvironment {
  SANDBOX = 'sandbox',
  PRODUCTION = 'production',
}

@Entity('clinics')
export class Clinic extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column('text')
  address: string;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 100 })
  province: string;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ name: 'sip_number', length: 50, nullable: true })
  sipNumber: string;

  @Column({ name: 'operational_hours', type: 'json', nullable: true })
  operationalHours: Record<string, any>;

  @Column({ name: 'satusehat_org_id', length: 100, nullable: true })
  satusehatOrgId: string;

  @Column({ name: 'satusehat_client_id', length: 255, nullable: true })
  satusehatClientId: string;

  @Column({ name: 'satusehat_client_secret', length: 255, nullable: true })
  satusehatClientSecret: string;

  @Column({
    name: 'satusehat_environment',
    type: 'enum',
    enum: SatusehatEnvironment,
    default: SatusehatEnvironment.SANDBOX,
  })
  satusehatEnvironment: SatusehatEnvironment;

  @Column({ name: 'satusehat_token', type: 'text', nullable: true })
  satusehatToken: string;

  @Column({ name: 'satusehat_token_expires_at', nullable: true })
  satusehatTokenExpiresAt: Date;

  @Column({ name: 'setup_complete', default: false })
  setupComplete: boolean;

  // Relations
  @OneToMany(() => User, (user) => user.clinic)
  users: User[];

  @OneToMany(() => Practitioner, (practitioner) => practitioner.clinic)
  practitioners: Practitioner[];

  @OneToMany(() => Location, (location) => location.clinic)
  locations: Location[];

  @OneToMany(() => Patient, (patient) => patient.clinic)
  patients: Patient[];
}
```

---

### **src/entities/core/user.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { Clinic } from './clinic.entity';
import { Practitioner } from './practitioner.entity';

@Entity('users')
@Index(['role', 'isActive'])
export class User extends BaseEntity {
  @Column({ name: 'clinic_id', nullable: true })
  clinicId: number;

  @Column({ name: 'practitioner_id', nullable: true })
  practitionerId: number;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({ name: 'email_verified_at', nullable: true })
  emailVerifiedAt: Date;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;

  // Relations
  @ManyToOne(() => Clinic, (clinic) => clinic.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Practitioner, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'practitioner_id' })
  practitioner: Practitioner;
}
```

---

### **src/entities/core/practitioner.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Gender } from '../../common/enums/gender.enum';
import { Clinic } from './clinic.entity';
import { Encounter } from '../clinical/encounter.entity';

@Entity('practitioners')
@Index(['nik', 'clinicId'], { unique: true })
export class Practitioner extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 16 })
  nik: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: Date;

  @Column({
    type: 'enum',
    enum: Gender,
  })
  gender: Gender;

  @Column({ length: 100, nullable: true })
  specialization: string;

  @Column({ name: 'satusehat_practitioner_id', length: 100, nullable: true })
  satusehatPractitionerId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, (clinic) => clinic.practitioners, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @OneToMany(() => Encounter, (encounter) => encounter.practitioner)
  encounters: Encounter[];
}
```

---

### **src/entities/core/location.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Clinic } from './clinic.entity';
import { Encounter } from '../clinical/encounter.entity';

@Entity('locations')
export class Location extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  type: string; // HOSP, ROOM, DEPT

  @Column({ name: 'satusehat_location_id', length: 100, nullable: true })
  satusehatLocationId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, (clinic) => clinic.locations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @OneToMany(() => Encounter, (encounter) => encounter.location)
  encounters: Encounter[];
}
```

---

## Patient Management Entities

### **src/entities/patient/patient.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Gender } from '../../common/enums/gender.enum';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import { Clinic } from '../core/clinic.entity';
import { Encounter } from '../clinical/encounter.entity';

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
}

@Entity('patients')
@Index(['noRm', 'clinicId'], { unique: true })
@Index(['nik', 'clinicId'], { unique: true })
export class Patient extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'no_rm', length: 20 })
  noRm: string;

  @Column({ length: 16, nullable: true })
  nik: string;

  @Column({ name: 'nik_ibu', length: 16, nullable: true })
  nikIbu: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: Date;

  @Column({ name: 'birth_order', nullable: true })
  birthOrder: number;

  @Column({
    type: 'enum',
    enum: Gender,
  })
  gender: Gender;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column('text', { nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 100, nullable: true })
  province: string;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string;

  @Column({
    name: 'marital_status',
    type: 'enum',
    enum: MaritalStatus,
    nullable: true,
  })
  maritalStatus: MaritalStatus;

  @Column({ name: 'ihs_number', length: 50, nullable: true })
  ihsNumber: string;

  @Column({ name: 'satusehat_patient_id', length: 100, nullable: true })
  satusehatPatientId: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  @Column('text', { name: 'sync_error', nullable: true })
  syncError: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;

  // Relations
  @ManyToOne(() => Clinic, (clinic) => clinic.patients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @OneToMany(() => Encounter, (encounter) => encounter.patient)
  encounters: Encounter[];
}
```

---

### **src/entities/patient/queue.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Clinic } from '../core/clinic.entity';
import { Patient } from './patient.entity';
import { Practitioner } from '../core/practitioner.entity';

export enum QueueStatus {
  WAITING = 'waiting',
  CONFIRMED = 'confirmed',
  CALLED = 'called',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

@Entity('queues')
@Index(['clinicId', 'tanggal', 'nomorAntrian'], { unique: true })
@Index(['clinicId', 'tanggal', 'status'])
@Index(['practitionerId', 'tanggal'])
export class Queue extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id', nullable: true })
  patientId: number;

  @Column({ name: 'practitioner_id' })
  practitionerId: number;

  @Column({ name: 'nomor_antrian' })
  nomorAntrian: number;

  @Column({ type: 'date' })
  tanggal: Date;

  @Column({ name: 'jam_slot', type: 'time' })
  jamSlot: string;

  @Column({ name: 'patient_name', length: 100 })
  patientName: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string;

  @Column({ name: 'is_first_visit', default: false })
  isFirstVisit: boolean;

  @Column({ name: 'is_online_booking', default: false })
  isOnlineBooking: boolean;

  @Column({ length: 8, unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.WAITING,
  })
  status: QueueStatus;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string;

  @Column({ name: 'called_at', nullable: true })
  calledAt: Date;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Patient, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Practitioner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'practitioner_id' })
  practitioner: Practitioner;
}
```

---

## Clinical Entities

### **src/entities/clinical/encounter.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, OneToMany, OneToOne, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import { EncounterStatus } from '../../common/enums/encounter-status.enum';
import { Clinic } from '../core/clinic.entity';
import { Patient } from '../patient/patient.entity';
import { Practitioner } from '../core/practitioner.entity';
import { Location } from '../core/location.entity';
import { Queue } from '../patient/queue.entity';
import { Anamnesis } from './anamnesis.entity';
import { Diagnosis } from './diagnosis.entity';
import { Procedure } from './procedure.entity';

export enum ServiceType {
  OUTPATIENT = 'outpatient',
  INPATIENT = 'inpatient',
  EMERGENCY = 'emergency',
}

@Entity('encounters')
@Index(['practitionerId', 'arrivedTime'])
export class Encounter extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'practitioner_id' })
  practitionerId: number;

  @Column({ name: 'location_id' })
  locationId: number;

  @Column({ name: 'queue_id', nullable: true })
  queueId: number;

  @Column({
    name: 'service_type',
    type: 'enum',
    enum: ServiceType,
    default: ServiceType.OUTPATIENT,
  })
  serviceType: ServiceType;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string;

  @Column({
    type: 'enum',
    enum: EncounterStatus,
    default: EncounterStatus.ARRIVED,
  })
  status: EncounterStatus;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string;

  @Column({ name: 'arrived_time' })
  arrivedTime: Date;

  @Column({ name: 'in_progress_time', nullable: true })
  inProgressTime: Date;

  @Column({ name: 'finished_time', nullable: true })
  finishedTime: Date;

  @Column({ name: 'satusehat_encounter_id', length: 100, nullable: true })
  satusehatEncounterId: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  @Column('text', { name: 'sync_error', nullable: true })
  syncError: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Patient, (patient) => patient.encounters, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Practitioner, (practitioner) => practitioner.encounters, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'practitioner_id' })
  practitioner: Practitioner;

  @ManyToOne(() => Location, (location) => location.encounters, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @ManyToOne(() => Queue, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;

  @OneToOne(() => Anamnesis, (anamnesis) => anamnesis.encounter)
  anamnesis: Anamnesis;

  @OneToMany(() => Diagnosis, (diagnosis) => diagnosis.encounter)
  diagnoses: Diagnosis[];

  @OneToMany(() => Procedure, (procedure) => procedure.encounter)
  procedures: Procedure[];
}
```

---

### **src/entities/clinical/anamnesis.entity.ts**

```typescript
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Encounter } from './encounter.entity';

export enum BloodType {
  A = 'A',
  B = 'B',
  AB = 'AB',
  O = 'O',
}

export enum Rhesus {
  POSITIVE = '+',
  NEGATIVE = '-',
}

export enum PregnancyStatus {
  PREGNANT = 'pregnant',
  NOT_PREGNANT = 'not_pregnant',
}

@Entity('anamnesis')
export class Anamnesis extends BaseEntity {
  @Column({ name: 'encounter_id', unique: true })
  encounterId: number;

  @Column({ name: 'keluhan_utama', type: 'text' })
  keluhanUtama: string;

  @Column({ name: 'riwayat_penyakit', type: 'text', nullable: true })
  riwayatPenyakit: string;

  @Column({
    name: 'golongan_darah',
    type: 'enum',
    enum: BloodType,
    nullable: true,
  })
  golonganDarah: BloodType;

  @Column({
    type: 'enum',
    enum: Rhesus,
    nullable: true,
  })
  rhesus: Rhesus;

  @Column({
    name: 'status_kehamilan',
    type: 'enum',
    enum: PregnancyStatus,
    nullable: true,
  })
  statusKehamilan: PregnancyStatus;

  // Relations
  @OneToOne(() => Encounter, (encounter) => encounter.anamnesis, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
```

---

### **src/entities/clinical/diagnosis.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import { Encounter } from './encounter.entity';

export enum ClinicalStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RESOLVED = 'resolved',
  RECURRENCE = 'recurrence',
  RELAPSE = 'relapse',
  REMISSION = 'remission',
}

export enum DiagnosisCategory {
  ENCOUNTER_DIAGNOSIS = 'encounter-diagnosis',
  PROBLEM_LIST_ITEM = 'problem-list-item',
}

@Entity('diagnoses')
@Index(['encounterId'])
export class Diagnosis extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'icd10_code', length: 10 })
  icd10Code: string;

  @Column({ name: 'icd10_display', length: 255 })
  icd10Display: string;

  @Column({
    name: 'clinical_status',
    type: 'enum',
    enum: ClinicalStatus,
    default: ClinicalStatus.ACTIVE,
  })
  clinicalStatus: ClinicalStatus;

  @Column({
    type: 'enum',
    enum: DiagnosisCategory,
    default: DiagnosisCategory.ENCOUNTER_DIAGNOSIS,
  })
  category: DiagnosisCategory;

  @Column({ name: 'body_site_code', length: 20, nullable: true })
  bodySiteCode: string;

  @Column({ name: 'body_site_display', length: 255, nullable: true })
  bodySiteDisplay: string;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate: Date;

  @Column('text', { nullable: true })
  note: string;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column({ name: 'satusehat_condition_id', length: 100, nullable: true })
  satusehatConditionId: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  // Relations
  @ManyToOne(() => Encounter, (encounter) => encounter.diagnoses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
```

---

### **src/entities/clinical/procedure.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import { Encounter } from './encounter.entity';
import { Diagnosis } from './diagnosis.entity';

export enum ProcedureStatus {
  PREPARATION = 'preparation',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NOT_DONE = 'not_done',
  STOPPED = 'stopped',
}

@Entity('procedures')
@Index(['encounterId'])
export class Procedure extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'icd9_code', length: 10 })
  icd9Code: string;

  @Column({ name: 'procedure_name', length: 255 })
  procedureName: string;

  @Column({
    type: 'enum',
    enum: ProcedureStatus,
    default: ProcedureStatus.COMPLETED,
  })
  status: ProcedureStatus;

  @Column({ name: 'performed_start' })
  performedStart: Date;

  @Column({ name: 'performed_end', nullable: true })
  performedEnd: Date;

  @Column({ name: 'reason_diagnosis_id', nullable: true })
  reasonDiagnosisId: number;

  @Column({ name: 'tooth_number', length: 5, nullable: true })
  toothNumber: string;

  @Column('text', { nullable: true })
  note: string;

  @Column({ name: 'satusehat_procedure_id', length: 100, nullable: true })
  satusehatProcedureId: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  // Relations
  @ManyToOne(() => Encounter, (encounter) => encounter.procedures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @ManyToOne(() => Diagnosis, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reason_diagnosis_id' })
  reasonDiagnosis: Diagnosis;
}
```

---

## Pharmacy Entities

### **src/entities/pharmacy/medication.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Clinic } from '../core/clinic.entity';

@Entity('medications')
@Index(['clinicId'])
@Index(['name'])
export class Medication extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'generic_name', length: 100, nullable: true })
  genericName: string;

  @Column({ length: 50, nullable: true })
  strength: string;

  @Column({ name: 'strength_unit', length: 20, nullable: true })
  strengthUnit: string;

  @Column({ name: 'dosage_form', length: 50 })
  dosageForm: string;

  @Column({ default: 0 })
  quantity: number;

  @Column({ name: 'min_stock', default: 0 })
  minStock: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ length: 100, nullable: true })
  supplier: string;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
```

---

### **src/entities/pharmacy/prescription.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { SyncStatus } from '../../common/enums/sync-status.enum';
import { Encounter } from '../clinical/encounter.entity';
import { Medication } from './medication.entity';

export enum PrescriptionStatus {
  ACTIVE = 'active',
  DISPENSED = 'dispensed',
  CANCELLED = 'cancelled',
}

export enum DurationUnit {
  DAYS = 'days',
  WEEKS = 'weeks',
  MONTHS = 'months',
}

@Entity('prescriptions')
@Index(['encounterId'])
@Index(['medicationId'])
export class Prescription extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'medication_id' })
  medicationId: number;

  @Column({ name: 'dosage_instruction', length: 255 })
  dosageInstruction: string;

  @Column()
  quantity: number;

  @Column({ nullable: true })
  duration: number;

  @Column({
    name: 'duration_unit',
    type: 'enum',
    enum: DurationUnit,
    nullable: true,
  })
  durationUnit: DurationUnit;

  @Column('text', { nullable: true })
  note: string;

  @Column({
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.ACTIVE,
  })
  status: PrescriptionStatus;

  @Column({ name: 'dispensed_at', nullable: true })
  dispensedAt: Date;

  @Column({ name: 'satusehat_medreq_id', length: 100, nullable: true })
  satusehatMedreqId: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  // Relations
  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @ManyToOne(() => Medication, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'medication_id' })
  medication: Medication;
}
```

---

## Billing Entities

### **src/entities/billing/billing.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Clinic } from '../core/clinic.entity';
import { Encounter } from '../clinical/encounter.entity';
import { Patient } from '../patient/patient.entity';
import { BillingItem } from './billing-item.entity';
import { Payment } from './payment.entity';

export enum BillingStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('billings')
@Index(['invoiceNumber'], { unique: true })
@Index(['clinicId'])
@Index(['encounterId'])
export class Billing extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'invoice_number', length: 50, unique: true })
  invoiceNumber: string;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { name: 'total_discount', precision: 10, scale: 2, default: 0 })
  totalDiscount: number;

  @Column('decimal', { name: 'grand_total', precision: 10, scale: 2 })
  grandTotal: number;

  @Column('decimal', { name: 'paid_amount', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column('decimal', { name: 'outstanding_amount', precision: 10, scale: 2 })
  outstandingAmount: number;

  @Column({
    type: 'enum',
    enum: BillingStatus,
    default: BillingStatus.UNPAID,
  })
  status: BillingStatus;

  @Column('text', { nullable: true })
  notes: string;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Encounter, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @OneToMany(() => BillingItem, (item) => item.billing)
  items: BillingItem[];

  @OneToMany(() => Payment, (payment) => payment.billing)
  payments: Payment[];
}
```

---

### **src/entities/billing/billing-item.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Billing } from './billing.entity';
import { Tarif } from './tarif.entity';

export enum DiscountType {
  NOMINAL = 'nominal',
  PERCENT = 'percent',
}

@Entity('billing_items')
export class BillingItem extends BaseEntity {
  @Column({ name: 'billing_id' })
  billingId: number;

  @Column({ name: 'tarif_id', nullable: true })
  tarifId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ default: 1 })
  quantity: number;

  @Column('decimal', { name: 'unit_price', precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.NOMINAL,
  })
  discountType: DiscountType;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  // Relations
  @ManyToOne(() => Billing, (billing) => billing.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billing_id' })
  billing: Billing;

  @ManyToOne(() => Tarif, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif;
}
```

---

### **src/entities/billing/payment.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Billing } from './billing.entity';

export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  INSURANCE = 'insurance',
  BPJS = 'bpjs',
}

@Entity('payments')
@Index(['receiptNumber'], { unique: true })
export class Payment extends BaseEntity {
  @Column({ name: 'billing_id' })
  billingId: number;

  @Column({ name: 'receipt_number', length: 50, unique: true })
  receiptNumber: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('text', { nullable: true })
  note: string;

  @Column({ name: 'paid_at' })
  paidAt: Date;

  // Relations
  @ManyToOne(() => Billing, (billing) => billing.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billing_id' })
  billing: Billing;
}
```

---

### **src/entities/billing/tarif.entity.ts**

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base/base.entity';
import { Clinic } from '../core/clinic.entity';

@Entity('tarifs')
@Index(['clinicId'])
export class Tarif extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  kategori: string;

  @Column({ name: 'kode_icd9', length: 10, nullable: true })
  kodeIcd9: string;

  @Column('decimal', { name: 'harga_pokok', precision: 10, scale: 2, default: 0 })
  hargaPokok: number;

  @Column('decimal', { name: 'harga_jual', precision: 10, scale: 2 })
  hargaJual: number;

  @Column('decimal', { name: 'diskon_maksimal', precision: 10, scale: 2, default: 0 })
  diskonMaksimal: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
```

---

## Complete Example: Module Setup

### **src/modules/patients/patients.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../../entities/patient/patient.entity';
import { Queue } from '../../entities/patient/queue.entity';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Queue]),
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
```

---

## Installation & Setup

```bash
# Install dependencies
npm install @nestjs/typeorm typeorm mysql2

# Install additional packages for validation
npm install class-validator class-transformer

# Install bcrypt for password hashing
npm install bcrypt
npm install -D @types/bcrypt
```

### **app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 3306),
        username: config.get('DB_USERNAME', 'root'),
        password: config.get('DB_PASSWORD', ''),
        database: config.get('DB_DATABASE', 'apexrecord'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // NEVER use true in production
        charset: 'utf8mb4',
        timezone: 'Z',
      }),
    }),
    // Import your modules here
  ],
})
export class AppModule {}
```

### **.env**

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_DATABASE=apexrecord
```

---

## Usage Example: Repository Pattern

### **src/modules/patients/patients.service.ts**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../entities/patient/patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  async findAll(clinicId: number): Promise<Patient[]> {
    return this.patientRepository.find({
      where: { clinicId },
      order: { noRm: 'ASC' },
    });
  }

  async findOne(id: number, clinicId: number): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { id, clinicId },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    return patient;
  }

  async create(data: Partial<Patient>): Promise<Patient> {
    const patient = this.patientRepository.create(data);
    return this.patientRepository.save(patient);
  }

  async update(id: number, clinicId: number, data: Partial<Patient>): Promise<Patient> {
    await this.findOne(id, clinicId); // Check if exists
    await this.patientRepository.update({ id, clinicId }, data);
    return this.findOne(id, clinicId);
  }
}
```

---

## Best Practices

1. **Use DTOs for validation:**
   - Create separate DTOs for Create, Update, and Response
   - Use `class-validator` decorators

2. **Transaction Management:**
   ```typescript
   await this.connection.transaction(async (manager) => {
     // Your transactional operations
   });
   ```

3. **Query Optimization:**
   - Use `relations` option to eager load
   - Use `QueryBuilder` for complex queries

4. **Soft Delete (Optional):**
   - Add `deletedAt` column to BaseEntity
   - Use `@DeleteDateColumn()` decorator

5. **Audit Trail:**
   - Already implemented in BaseEntity (created_by, updated_by)
   - Use middleware/interceptor to auto-populate

---

**Complete! 🎉**

Seluruh entitas telah didefinisikan dengan TypeORM decorators dan siap digunakan dalam NestJS project.

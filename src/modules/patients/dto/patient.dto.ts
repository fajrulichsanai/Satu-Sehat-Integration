import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  Gender,
  MaritalStatus,
  SyncStatus,
  BloodType,
  Rhesus,
  HubunganWali,
  SumberInformasi,
  PreferensiKontak,
  PreferensiJamKontak,
} from '../../../enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { IsValidNIK } from '../../../common/validators/nik.validator';

function isMinor(dateOfBirth?: string): boolean {
  if (!dateOfBirth) return false;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate()))
    age--;
  return age < 17;
}

export class CreatePatientDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string | undefined;

  @ApiPropertyOptional({
    example: '3171234567890001',
    description: 'Required unless isNewborn',
  })
  @IsOptional()
  @IsValidNIK()
  nik?: string;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender | undefined;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 1, Jakarta' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Sukasari' })
  @IsOptional()
  @MaxLength(100)
  kelurahan?: string;

  @ApiPropertyOptional({ example: 'Cibeunying' })
  @IsOptional()
  @MaxLength(100)
  kecamatan?: string;

  @ApiPropertyOptional({ example: 'Jakarta' })
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'DKI Jakarta' })
  @IsOptional()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'budi@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Karyawan Swasta' })
  @IsOptional()
  @MaxLength(100)
  pekerjaan?: string;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({
    example: false,
    description: 'Set true for newborn without NIK',
  })
  @IsOptional()
  isNewborn?: boolean;

  @ApiPropertyOptional({
    example: 'Siti Rahayu',
    description: 'NIK Ibu (for newborn)',
  })
  @IsOptional()
  @IsValidNIK()
  nikIbu?: string;

  // Data Wali (wajib jika usia < 17 tahun)
  @ApiPropertyOptional({ example: 'Siti Rahayu' })
  @ValidateIf((dto: CreatePatientDto) => isMinor(dto.dateOfBirth))
  @IsNotEmpty({
    message: 'Nama wali wajib diisi untuk pasien di bawah 17 tahun',
  })
  @MaxLength(100)
  namaWali?: string;

  @ApiPropertyOptional({ enum: HubunganWali })
  @ValidateIf((dto: CreatePatientDto) => isMinor(dto.dateOfBirth))
  @IsNotEmpty({
    message: 'Hubungan wali wajib diisi untuk pasien di bawah 17 tahun',
  })
  @IsEnum(HubunganWali)
  hubunganWali?: HubunganWali;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  birthOrder?: number;

  // Akuisisi & Marketing
  @ApiPropertyOptional({ enum: SumberInformasi })
  @IsOptional()
  @IsEnum(SumberInformasi)
  sumberInformasi?: SumberInformasi;

  @ApiPropertyOptional({ example: 'Direkomendasikan dokter lain' })
  @ValidateIf(
    (dto: CreatePatientDto) => dto.sumberInformasi === SumberInformasi.LAINNYA,
  )
  @IsNotEmpty({
    message: 'Detail sumber wajib diisi jika sumber informasi "Lainnya"',
  })
  @MaxLength(200)
  detailSumber?: string;

  @ApiPropertyOptional({ example: 'REF12345' })
  @IsOptional()
  @MaxLength(50)
  kodeReferral?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  referrerPatientId?: number;

  // Riwayat Medis Singkat
  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  golonganDarah?: BloodType;

  @ApiPropertyOptional({ enum: Rhesus })
  @IsOptional()
  @IsEnum(Rhesus)
  rhesus?: Rhesus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  punyaAlergi?: boolean;

  @ApiPropertyOptional({ example: 'Alergi penisilin' })
  @ValidateIf((dto: CreatePatientDto) => dto.punyaAlergi === true)
  @IsNotEmpty({
    message: 'Catatan alergi wajib diisi jika pasien memiliki alergi',
  })
  @IsString()
  catatanAlergi?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  riwayatHipertensi?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  riwayatDiabetes?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  riwayatParuParu?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  riwayatSyaraf?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  riwayatSistemikLainnya?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  alergiObat?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  alergiMakanan?: boolean;

  // Preferensi & Membership
  @ApiPropertyOptional({ enum: PreferensiKontak })
  @IsOptional()
  @IsEnum(PreferensiKontak)
  preferensiKontak?: PreferensiKontak;

  @ApiPropertyOptional({ enum: PreferensiJamKontak })
  @IsOptional()
  @IsEnum(PreferensiJamKontak)
  preferensiJamKontak?: PreferensiJamKontak;

  @ApiPropertyOptional({ example: 'Hubungi setelah jam 17.00' })
  @IsOptional()
  @IsString()
  catatanPreferensi?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMember?: boolean;

  @ApiPropertyOptional({ example: 'MBR-0001' })
  @ValidateIf((dto: CreatePatientDto) => dto.isMember === true)
  @IsNotEmpty({ message: 'Member ID wajib diisi jika pasien adalah member' })
  @MaxLength(50)
  memberId?: string;

  // Persetujuan
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  consentMarketing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  consentTanggal?: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsOptional()
  @MaxLength(20)
  consentVersion?: string;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}

export class PatientQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name, NIK, or No. RM' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}

export class PatientResponseDto {
  @ApiProperty() id: number | undefined;
  @ApiProperty() noRm: string | undefined;
  @ApiProperty() clinicId: number | undefined;
  @ApiPropertyOptional() nik?: string;
  @ApiProperty() name: string | undefined;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiProperty({ enum: Gender }) gender: Gender | undefined;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() address?: string;
  @ApiPropertyOptional() kelurahan?: string;
  @ApiPropertyOptional() kecamatan?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() province?: string;
  @ApiPropertyOptional({ enum: MaritalStatus }) maritalStatus?: MaritalStatus;
  @ApiPropertyOptional() satusehatPatientId?: string;
  @ApiProperty({ enum: SyncStatus }) syncStatus: SyncStatus | undefined;
  @ApiProperty() createdAt: Date | undefined;
  @ApiProperty() updatedAt: Date | undefined;
}

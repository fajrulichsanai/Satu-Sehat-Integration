import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Gender } from '../../../enums';

/** Profesi tenaga kesehatan (UU 36/2014 — kelompok nakes yang umum di klinik). */
export const PRACTITIONER_PROFESSIONS = [
  'dokter',
  'dokter_gigi',
  'dokter_spesialis',
  'dokter_gigi_spesialis',
  'perawat',
  'perawat_gigi',
  'bidan',
  'apoteker',
  'tenaga_teknis_kefarmasian',
  'analis_kesehatan',
  'radiografer',
  'nutrisionis',
  'fisioterapis',
  'lainnya',
] as const;

/** Field opsional yang sama untuk tambah & revisi. Kosong ('') = hapus nilai. */
class PractitionerOptionalFields {
  @ApiProperty({ example: 'dokter_gigi', required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v !== null)
  @IsIn(PRACTITIONER_PROFESSIONS, { message: 'Profesi tidak dikenal' })
  profession?: string;

  @ApiProperty({ example: '1990-06-12', required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v !== null)
  @IsDateString()
  birthDate?: string | null;

  @ApiProperty({ example: 'Bandung', required: false })
  @IsOptional()
  @MaxLength(100)
  birthPlace?: string;

  @ApiProperty({ example: 'Jl. Merdeka No. 1, Bandung', required: false })
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @ApiProperty({ example: '081234567890', required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v !== null)
  @Matches(/^\+?\d{8,15}$/, { message: 'Nomor HP 8–15 digit angka' })
  phone?: string;

  @ApiProperty({ example: 'dokter@example.com', required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v !== null)
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(100)
  email?: string;

  @ApiProperty({ example: 'SIP/123/2026', required: false })
  @IsOptional()
  @MaxLength(50)
  sipNumber?: string;

  @ApiProperty({ example: '2031-06-12', required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v !== null)
  @IsDateString()
  sipExpiredAt?: string | null;

  @ApiProperty({
    example: 'STR/123/2026',
    required: false,
    description: 'Surat Tanda Registrasi — dicetak di kop resep',
  })
  @IsOptional()
  @MaxLength(50)
  strNumber?: string;

  @ApiProperty({ example: '2031-06-12', required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== '' && v !== null)
  @IsDateString()
  strExpiredAt?: string | null;

  @ApiProperty({ example: 'Spesialis Konservasi Gigi', required: false })
  @IsOptional()
  @MaxLength(100)
  specialization?: string;

  @ApiProperty({
    example: 'N10000001',
    description: 'SATUSEHAT Practitioner ID (IHS)',
    required: false,
  })
  @IsOptional()
  @MaxLength(100)
  satusehatPractitionerId?: string;
}

export class CreatePractitionerDto extends PractitionerOptionalFields {
  @ApiProperty({ example: 'drg. Ratna Sari' })
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(100)
  name: string | undefined;

  @ApiProperty({ example: '3201012312310001', description: '16-digit NIK' })
  @IsNotEmpty({ message: 'NIK wajib diisi' })
  @Length(16, 16)
  @Matches(/^\d{16}$/, { message: 'NIK harus 16 digit angka' })
  nik: string | undefined;

  @ApiProperty({ example: 'male', enum: Gender })
  @IsEnum(Gender, { message: 'Jenis kelamin wajib dipilih' })
  @IsNotEmpty()
  gender: Gender | undefined;
}

export class UpdatePractitionerDto extends PractitionerOptionalFields {
  @ApiProperty({ example: 'drg. Ratna Sari', required: false })
  @IsOptional()
  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: '3201012312310001', required: false })
  @IsOptional()
  @Matches(/^\d{16}$/, { message: 'NIK harus 16 digit angka' })
  nik?: string;

  @ApiProperty({ example: 'female', enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: 'Salah ketik nama',
    required: false,
    description: 'Alasan revisi — dicatat di riwayat revisi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class SearchSatusehatPractitionerDto {
  @ApiProperty({
    example: '3201012312310001',
    description: 'NIK (16 digit)',
    required: false,
  })
  @IsOptional()
  @Matches(/^\d{16}$/, { message: 'NIK harus 16 digit angka' })
  nik?: string;

  @ApiProperty({ example: '10009880728', required: false })
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{3,64}$/, { message: 'ID SATUSEHAT tidak valid' })
  ihsId?: string;

  @ApiProperty({ example: 'Ratna', required: false })
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'female', enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ example: '1990-06-12', required: false })
  @IsOptional()
  @IsDateString()
  birthDate?: string;
}

export class PractitionerResponseDto {
  @ApiProperty({ example: 1 })
  id: number | undefined;

  @ApiProperty({ example: 'Dr. John Doe, Sp.KG' })
  name: string | undefined;

  @ApiProperty({ example: '3201012312310001' })
  nik: string | undefined;

  @ApiProperty({ example: 'male' })
  gender: string | undefined;

  @ApiProperty({ example: '081234567890' })
  phone: string | undefined;

  @ApiProperty({ example: 'dokter@example.com' })
  email: string | undefined;

  @ApiProperty({ example: 'SIP/123/2026' })
  sipNumber: string | undefined;

  @ApiProperty({ example: 'STR/123/2026' })
  strNumber: string | undefined;

  @ApiProperty({ example: 'Spesialis Konservasi Gigi' })
  specialization: string | undefined;

  @ApiProperty({ example: 'N10000001' })
  satusehatPractitionerId: string | undefined;

  @ApiProperty({ example: 1 })
  clinicId: number | undefined;

  @ApiProperty({ example: '2026-06-11T12:00:00Z' })
  createdAt: Date | undefined;
}

export class PractitionerListResponseDto {
  @ApiProperty({ example: true })
  success: boolean | undefined;

  @ApiProperty({ type: [PractitionerResponseDto] })
  data: PractitionerResponseDto[] | undefined;
}

export class SatusehatPractitionerSearchResultDto {
  @ApiProperty({ example: true })
  success: boolean | undefined;

  @ApiProperty({
    example: {
      id: 'N10000001',
      name: 'Dr. John Doe, Sp.KG',
      nik: '3201012312310001',
      gender: 'male',
      found: true,
      note: 'TODO: Implement actual SATUSEHAT API call',
    },
  })
  data: any | undefined;
}

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE = 'Password minimal 8 karakter, berisi huruf dan angka';

/** Akun login untuk nakes (dokter/perawat) — tertaut ke data nakes. */
export class CreatePractitionerAccountDto {
  @ApiProperty({ example: 'dr.ratna@klinik.id' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(100)
  email: string;

  @ApiProperty({ example: 'Rahasia123' })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ enum: ['dokter', 'perawat'], required: false })
  @IsOptional()
  @IsIn(['dokter', 'perawat'])
  role?: 'dokter' | 'perawat';
}

export class UpdatePractitionerAccountDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(100)
  email?: string;

  @ApiProperty({ required: false, description: 'Password baru (reset)' })
  @IsOptional()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

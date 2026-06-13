import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { Gender } from '../../../enums';

export class CreatePractitionerDto {
  @ApiProperty({ example: 'Dr. John Doe, Sp.KG' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string | undefined;

  @ApiProperty({ example: '3201012312310001', description: '16-digit NIK' })
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^\d{16}$/, { message: 'NIK harus 16 digit angka' })
  nik: string | undefined;

  @ApiProperty({ example: 'male', enum: Gender })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender | undefined;

  @ApiProperty({ example: '081234567890', required: false })
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: 'dokter@example.com', required: false })
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @ApiProperty({ example: 'SIP/123/2026', required: false })
  @IsOptional()
  @MaxLength(50)
  sipNumber?: string;

  @ApiProperty({ example: 'Spesialis Konservasi Gigi', required: false })
  @IsOptional()
  @MaxLength(100)
  specialization?: string;

  @ApiProperty({ example: 'N10000001', description: 'SATUSEHAT Practitioner ID', required: false })
  @IsOptional()
  @MaxLength(100)
  satusehatPractitionerId?: string;
}

export class UpdatePractitionerDto {
  @ApiProperty({ example: 'Dr. John Doe, Sp.KG', required: false })
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: '081234567890', required: false })
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: 'dokter@example.com', required: false })
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @ApiProperty({ example: 'SIP/123/2026', required: false })
  @IsOptional()
  @MaxLength(50)
  sipNumber?: string;

  @ApiProperty({ example: 'Spesialis Konservasi Gigi', required: false })
  @IsOptional()
  @MaxLength(100)
  specialization?: string;

  @ApiProperty({ example: 'N10000001', required: false })
  @IsOptional()
  @MaxLength(100)
  satusehatPractitionerId?: string;
}

export class SearchSatusehatPractitionerDto {
  @ApiProperty({ example: '3201012312310001', description: 'NIK to search in SATUSEHAT' })
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^\d{16}$/, { message: 'NIK harus 16 digit angka' })
  nik: string | undefined;
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

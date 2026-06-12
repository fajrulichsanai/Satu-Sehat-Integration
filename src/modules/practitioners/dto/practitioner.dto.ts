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
  name: string;

  @ApiProperty({ example: '3201012312310001', description: '16-digit NIK' })
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^\d{16}$/, { message: 'NIK harus 16 digit angka' })
  nik: string;

  @ApiProperty({ example: 'male', enum: Gender })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender;

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
  nik: string;
}

export class PractitionerResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Dr. John Doe, Sp.KG' })
  name: string;

  @ApiProperty({ example: '3201012312310001' })
  nik: string;

  @ApiProperty({ example: 'male' })
  gender: string;

  @ApiProperty({ example: '081234567890' })
  phone: string;

  @ApiProperty({ example: 'dokter@example.com' })
  email: string;

  @ApiProperty({ example: 'SIP/123/2026' })
  sipNumber: string;

  @ApiProperty({ example: 'Spesialis Konservasi Gigi' })
  specialization: string;

  @ApiProperty({ example: 'N10000001' })
  satusehatPractitionerId: string;

  @ApiProperty({ example: 1 })
  clinicId: number;

  @ApiProperty({ example: '2026-06-11T12:00:00Z' })
  createdAt: Date;
}

export class PractitionerListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [PractitionerResponseDto] })
  data: PractitionerResponseDto[];
}

export class SatusehatPractitionerSearchResultDto {
  @ApiProperty({ example: true })
  success: boolean;

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
  data: any;
}

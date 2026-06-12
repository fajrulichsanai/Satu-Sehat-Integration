import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MaxLength,
  IsEnum,
  IsString,
} from 'class-validator';
import { SatusehatEnvironment } from '../../../enums';

export class UpdateClinicDto {
  @ApiProperty({ example: 'Klinik Sehat Bersama' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Jl. Kesehatan No. 123' })
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Jakarta Selatan' })
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'DKI Jakarta' })
  @IsNotEmpty()
  @MaxLength(100)
  province: string;

  @ApiProperty({ example: '12345', required: false })
  @IsOptional()
  @MaxLength(10)
  postalCode?: string;

  @ApiProperty({ example: '021-12345678' })
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({ example: 'info@klinik.com', required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiProperty({ example: 'SIP/001/2026', required: false })
  @IsOptional()
  @MaxLength(50)
  sipNumber?: string;

  @ApiProperty({
    example: {
      senin: '08:00-17:00',
      selasa: '08:00-17:00',
      rabu: '08:00-17:00',
      kamis: '08:00-17:00',
      jumat: '08:00-16:00',
      sabtu: '08:00-12:00',
      minggu: 'Tutup',
    },
    required: false,
  })
  @IsOptional()
  operationalHours?: Record<string, any>;
}

export class SatusehatConfigDto {
  @ApiProperty({ example: 'ORG123456' })
  @IsNotEmpty()
  @MaxLength(100)
  satusehatOrgId: string;

  @ApiProperty({ example: 'client_id_from_satusehat' })
  @IsNotEmpty()
  @MaxLength(255)
  satusehatClientId: string;

  @ApiProperty({ example: 'client_secret_from_satusehat' })
  @IsNotEmpty()
  @MaxLength(255)
  satusehatClientSecret: string;

  @ApiProperty({
    example: 'sandbox',
    enum: SatusehatEnvironment,
    description: 'SATUSEHAT environment',
  })
  @IsEnum(SatusehatEnvironment)
  @IsNotEmpty()
  satusehatEnvironment: SatusehatEnvironment;
}

export class ClinicResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Klinik Sehat Bersama' })
  name: string;

  @ApiProperty({ example: 'Jl. Kesehatan No. 123' })
  address: string;

  @ApiProperty({ example: 'Jakarta Selatan' })
  city: string;

  @ApiProperty({ example: 'DKI Jakarta' })
  province: string;

  @ApiProperty({ example: '12345' })
  postalCode: string;

  @ApiProperty({ example: '021-12345678' })
  phone: string;

  @ApiProperty({ example: 'info@klinik.com' })
  email: string;

  @ApiProperty({ example: 'SIP/001/2026' })
  sipNumber: string;

  @ApiProperty({ example: { senin: '08:00-17:00' } })
  operationalHours: Record<string, any>;

  @ApiProperty({ example: 'ORG123456' })
  satusehatOrgId: string;

  @ApiProperty({ example: true })
  setupComplete: boolean;

  @ApiProperty({ example: 'sandbox' })
  satusehatEnvironment: string;
}

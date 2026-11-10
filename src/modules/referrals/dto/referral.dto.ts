import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CARE_TYPE_KEYS } from '../referral-codes';
import type { CareType } from '../referral-codes';

export class CreateReferralDto {
  @ApiProperty({ enum: CARE_TYPE_KEYS, example: 'outpatient' })
  @IsIn(CARE_TYPE_KEYS)
  careType: CareType;

  @ApiProperty({ description: 'Diagnosis utama (ICD-10)', example: 'K04.7' })
  @IsString()
  @MaxLength(10)
  primaryDiagnosis: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Diagnosis sekunder (ICD-10)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  secondaryDiagnoses?: string[];

  @ApiProperty({
    description: 'Kelompok layanan (Lampiran 4)',
    example: 'TK000584',
  })
  @Matches(/^TK\d{6}$/)
  serviceGroup: string;

  @ApiProperty({
    description: 'Poli tujuan (clinical-speciality)',
    example: 'LY086',
  })
  @IsString()
  @MaxLength(10)
  specialty: string;

  @ApiPropertyOptional({
    description: 'Jenis nakes pelaksana (SNOMED)',
    example: '49993003',
  })
  @IsOptional()
  @Matches(/^\d{6,18}$/)
  performerType?: string;

  @ApiProperty({ example: 'Abses rahang, perlu tindakan bedah mulut' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  patientInstruction?: string;

  @ApiProperty({ example: '2026-10-10' })
  @IsDateString()
  plannedDate: string;

  @ApiPropertyOptional({ description: 'Nomor rujukan PCare (peserta BPJS)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pcareNumber?: string;

  @ApiPropertyOptional({
    description:
      'true = rujukan manual (surat rujukan saja, tidak lewat SATUSEHAT)',
  })
  @IsOptional()
  @IsBoolean()
  manual?: boolean;

  @ApiPropertyOptional({
    description: 'Nama RS tujuan (wajib untuk rujukan manual)',
  })
  @ValidateIf((o: CreateReferralDto) => o.manual === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  targetName?: string;
}

export class ReferralAreaDto {
  @Matches(/^\d{2}$/)
  provinceCode: string;

  @IsString()
  @MaxLength(100)
  provinceName: string;

  @Matches(/^\d{4}$/)
  cityCode: string;

  @IsString()
  @MaxLength(100)
  cityName: string;
}

export class SearchCandidatesDto {
  @ApiProperty({ description: 'Jawaban kuesioner kriteria (linkId → nilai)' })
  @IsObject()
  criteria: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Jawaban kuesioner jejaring wilayah (bila diberikan SATUSEHAT)',
  })
  @IsOptional()
  @IsObject()
  areaAnswers?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: ReferralAreaDto,
    description: 'Wilayah rujukan bila tidak ada kuesioner wilayah',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReferralAreaDto)
  area?: ReferralAreaDto;
}

export class SendReferralDto {
  @ApiProperty({
    description: 'ID Organization SATUSEHAT RS tujuan (dari kandidat)',
  })
  @IsString()
  @MaxLength(100)
  targetOrgId: string;
}

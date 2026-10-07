import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CLINICAL_STATUS_KEYS,
  CONDITION_SEVERITY_KEYS,
  OBSERVATION_CATALOG,
  VERIFICATION_STATUS_KEYS,
} from '../clinical-codes';
import type {
  ClinicalStatus,
  ConditionSeverity,
  VerificationStatus,
} from '../clinical-codes';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateConditionDto {
  @ApiPropertyOptional({ enum: CLINICAL_STATUS_KEYS, default: 'active' })
  @IsOptional()
  @IsIn(CLINICAL_STATUS_KEYS)
  clinicalStatus?: ClinicalStatus;

  @ApiPropertyOptional({ enum: VERIFICATION_STATUS_KEYS, default: 'confirmed' })
  @IsOptional()
  @IsIn(VERIFICATION_STATUS_KEYS)
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional({ enum: CONDITION_SEVERITY_KEYS, nullable: true })
  @IsOptional()
  @IsIn(CONDITION_SEVERITY_KEYS)
  severity?: ConditionSeverity | null;

  @ApiPropertyOptional({ example: '2024-01-15', nullable: true })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'Tanggal mulai harus berformat YYYY-MM-DD' })
  onsetDate?: string | null;

  @ApiPropertyOptional({ example: '2025-03-01', nullable: true })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'Tanggal sembuh harus berformat YYYY-MM-DD' })
  abatementDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class CreateConditionDto extends UpdateConditionDto {
  @ApiProperty({ enum: ['icd10', 'snomed'] })
  @IsIn(['icd10', 'snomed'])
  system: 'icd10' | 'snomed';

  @ApiProperty({ example: 'I10' })
  @IsString()
  @MaxLength(30)
  code: string;
}

export class UpdateObservationDto {
  @ApiPropertyOptional({
    description: 'Nilai angka (observasi berjenis angka)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  value?: number | null;

  @ApiPropertyOptional({
    description: 'Kode jawaban (observasi berjenis pilihan)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  valueCode?: string | null;

  @ApiPropertyOptional({ description: 'Waktu pemeriksaan (default: sekarang)' })
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class CreateObservationDto extends UpdateObservationDto {
  @ApiProperty({ enum: OBSERVATION_CATALOG.map((d) => d.key) })
  @IsIn(OBSERVATION_CATALOG.map((d) => d.key))
  observationKey: string;
}

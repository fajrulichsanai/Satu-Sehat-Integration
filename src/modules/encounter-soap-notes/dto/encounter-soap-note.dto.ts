import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SoapDiagnosisDto {
  @ApiProperty({ enum: ['icd10', 'snomed'] })
  @IsIn(['icd10', 'snomed'])
  system: 'icd10' | 'snomed';

  @ApiProperty({ example: 'K02.1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ description: 'Diagnosis utama' })
  @IsOptional()
  @IsBoolean()
  primary?: boolean;

  @ApiPropertyOptional({ description: 'Catatan, mis. elemen gigi 36' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class UpsertEncounterSoapNoteDto {
  @ApiPropertyOptional({ description: 'Subjective - keluhan/cerita pasien' })
  @IsOptional()
  @IsString()
  subjective?: string;

  @ApiPropertyOptional({ description: 'Objective - hasil pemeriksaan' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: 'Assessment - diagnosis/penilaian' })
  @IsOptional()
  @IsString()
  assessment?: string;

  @ApiPropertyOptional({
    type: [SoapDiagnosisDto],
    description:
      'Diagnosis terkode (ICD-10/SNOMED CT); menggantikan daftar sebelumnya bila dikirim',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SoapDiagnosisDto)
  diagnoses?: SoapDiagnosisDto[];

  @ApiPropertyOptional({
    description: 'Treatment - tindakan yang dilakukan pada kunjungan ini',
  })
  @IsOptional()
  @IsString()
  treatment?: string;

  @ApiPropertyOptional({
    description: 'Plan - rencana untuk kunjungan berikutnya',
  })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({
    description: 'Kontrol - rencana kontrol/kunjungan ulang berikutnya',
  })
  @IsOptional()
  @IsString()
  controlPlan?: string;

  @ApiPropertyOptional({
    description: 'Tanda tangan dokter (base64 PNG data URL)',
  })
  @IsOptional()
  @IsString()
  signature?: string;
}

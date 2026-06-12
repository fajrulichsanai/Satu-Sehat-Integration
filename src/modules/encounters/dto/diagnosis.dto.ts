import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClinicalStatus, DiagnosisCategory } from '../../../entities/diagnosis.entity';

export class CreateDiagnosisDto {
  @ApiProperty({ example: 'K02.1' })
  @IsString()
  @IsNotEmpty()
  icd10Code: string;

  @ApiProperty({ example: 'Dental caries limited to enamel' })
  @IsString()
  @IsNotEmpty()
  icd10Display: string;

  @ApiPropertyOptional({ enum: ClinicalStatus, default: ClinicalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ClinicalStatus)
  clinicalStatus?: ClinicalStatus;

  @ApiPropertyOptional({ enum: DiagnosisCategory, default: DiagnosisCategory.ENCOUNTER_DIAGNOSIS })
  @IsOptional()
  @IsEnum(DiagnosisCategory)
  category?: DiagnosisCategory;

  @ApiPropertyOptional({ example: '76505004' })
  @IsOptional()
  @IsString()
  bodySiteCode?: string;

  @ApiPropertyOptional({ example: 'Lower right first molar tooth' })
  @IsOptional()
  @IsString()
  bodySiteDisplay?: string;

  @ApiPropertyOptional({ example: '2026-06-08' })
  @IsOptional()
  @IsDateString()
  onsetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isPrimary?: boolean;
}

import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TreatmentType, TreatmentPlanStatus, TreatmentSessionStatus } from '../../../enums';

export class CreateTreatmentPlanDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  patientId: number;

  @ApiProperty({ enum: TreatmentType })
  @IsEnum(TreatmentType)
  treatmentType: TreatmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Total tahap treatment (kosongkan jika open-ended)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalStages?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class UpdateTreatmentPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  totalStages?: number;

  @ApiPropertyOptional({ enum: TreatmentPlanStatus })
  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class CreateTreatmentPlanSessionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  encounterId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: TreatmentSessionStatus })
  @IsOptional()
  @IsEnum(TreatmentSessionStatus)
  status?: TreatmentSessionStatus;
}

export class UpdateTreatmentPlanSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: TreatmentSessionStatus })
  @IsOptional()
  @IsEnum(TreatmentSessionStatus)
  status?: TreatmentSessionStatus;
}

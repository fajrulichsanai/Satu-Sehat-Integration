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
import { ProcedureStatus } from '../../../entities/procedure.entity';

export class CreateProcedureDto {
  @ApiProperty({ example: '96.54' })
  @IsString()
  @IsNotEmpty()
  icd9Code: string;

  @ApiProperty({ example: 'Dental scaling' })
  @IsString()
  @IsNotEmpty()
  procedureName: string;

  @ApiPropertyOptional({ enum: ProcedureStatus, default: ProcedureStatus.COMPLETED })
  @IsOptional()
  @IsEnum(ProcedureStatus)
  status?: ProcedureStatus;

  @ApiProperty()
  @IsDateString()
  performedStart: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  performedEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  reasonDiagnosisId?: number;

  @ApiPropertyOptional({ description: 'FDI tooth notation (e.g. 46)', example: '46' })
  @IsOptional()
  @IsString()
  toothNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

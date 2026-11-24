import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsString,
  MaxLength,
  IsInt,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { PatientRecallStatus } from '../entities/patient-recall.entity';
import { RECALL_KINDS, type RecallKind } from '../recall-kind';

export class PatientRecallQueryDto {
  @ApiPropertyOptional({ enum: PatientRecallStatus })
  @IsOptional()
  @IsEnum(PatientRecallStatus)
  status?: PatientRecallStatus;

  @ApiPropertyOptional({ enum: RECALL_KINDS })
  @IsOptional()
  @IsIn(RECALL_KINDS as unknown as string[])
  kind?: RecallKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;
}

export class UpdatePatientRecallDto {
  @ApiPropertyOptional({ enum: PatientRecallStatus })
  @IsOptional()
  @IsEnum(PatientRecallStatus)
  status?: PatientRecallStatus;

  @ApiPropertyOptional({ description: 'Override tanggal recall (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreatePatientRecallDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  patientId: number;

  @ApiPropertyOptional({ description: 'Tanggal kontrol (YYYY-MM-DD)' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ enum: RECALL_KINDS, default: 'kunjungan' })
  @IsOptional()
  @IsIn(RECALL_KINDS as unknown as string[])
  kind?: RecallKind;

  @ApiPropertyOptional({
    description:
      'true (bawaan) bila reservasi kontrolnya sudah dibuat, jadi langsung berstatus Sudah Booking Ulang',
  })
  @IsOptional()
  @IsBoolean()
  booked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

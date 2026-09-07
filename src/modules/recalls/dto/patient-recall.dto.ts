import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PatientRecallStatus } from '../entities/patient-recall.entity';

export class PatientRecallQueryDto {
  @ApiPropertyOptional({ enum: PatientRecallStatus })
  @IsOptional()
  @IsEnum(PatientRecallStatus)
  status?: PatientRecallStatus;

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

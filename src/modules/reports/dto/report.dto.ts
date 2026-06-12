import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EncounterStatus } from '../../../enums';

export class VisitReportQueryDto {
  @ApiProperty()
  @IsDateString()
  dateFrom: string;

  @ApiProperty()
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practitionerId?: number;

  @ApiPropertyOptional({ enum: EncounterStatus })
  @IsOptional()
  @IsEnum(EncounterStatus)
  status?: EncounterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}

export class FinancialReportQueryDto {
  @ApiProperty()
  @IsDateString()
  dateFrom: string;

  @ApiProperty()
  @IsDateString()
  dateTo: string;

  @ApiPropertyOptional({ enum: ['summary', 'detailed'], default: 'summary' })
  @IsOptional()
  @IsString()
  type?: 'summary' | 'detailed' = 'summary';
}

export class SatusehatSyncReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ enum: ['synced', 'failed', 'pending', 'all'], default: 'all' })
  @IsOptional()
  @IsString()
  syncStatus?: string;
}

export class RetrySyncDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  localIds?: number[];
}

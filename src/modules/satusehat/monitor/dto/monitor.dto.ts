import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SyncLogStatus } from '../../sync/entities/satusehat-sync-log.entity';

/** Tab data di menu SATUSEHAT */
export const SATUSEHAT_RESOURCE_TYPES = [
  'Patient',
  'Encounter',
  'Procedure',
  'MedicationRequest',
  'Practitioner',
  'Location',
] as const;

/** Filter log: dicocokkan sebagai awalan resource_type (mis. "Observation:pe_8480-6") */
export const LOG_RESOURCE_TYPES = [
  'Patient',
  'Practitioner',
  'Location',
  'Encounter',
  'Observation',
  'Condition',
  'Procedure',
  'Medication',
  'MedicationRequest',
] as const;

export type SatusehatResourceType = (typeof SATUSEHAT_RESOURCE_TYPES)[number];

/**
 * synced  = sudah punya ID SATUSEHAT (terverifikasi/terkirim)
 * pending = belum dikirim / belum terdaftar
 * failed  = pengiriman terakhir gagal
 */
export const MONITOR_STATUSES = ['synced', 'pending', 'failed'] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

class PageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ListResourcesQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: MONITOR_STATUSES })
  @IsOptional()
  @IsIn(MONITOR_STATUSES)
  status?: MonitorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ListSyncLogsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: LOG_RESOURCE_TYPES })
  @IsOptional()
  @IsIn(LOG_RESOURCE_TYPES)
  resourceType?: (typeof LOG_RESOURCE_TYPES)[number];

  @ApiPropertyOptional({ enum: SyncLogStatus })
  @IsOptional()
  @IsIn(Object.values(SyncLogStatus))
  status?: SyncLogStatus;
}

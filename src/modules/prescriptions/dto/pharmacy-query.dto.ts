import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** pending = belum ada obat diserahkan/diberikan, partial = sebagian, done = semua */
export const PHARMACY_STATUSES = ['pending', 'partial', 'done'] as const;
export type PharmacyStatus = (typeof PHARMACY_STATUSES)[number];

export class PharmacyQueueQueryDto {
  @ApiPropertyOptional({ description: 'Nama pasien, No. RM, atau nama obat' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: PHARMACY_STATUSES })
  @IsOptional()
  @IsIn(PHARMACY_STATUSES)
  status?: PharmacyStatus;

  @ApiPropertyOptional({ description: 'Tanggal kunjungan mulai (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Tanggal kunjungan sampai (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practitionerId?: number;

  @ApiPropertyOptional({
    description: 'Semua resep satu pasien (abaikan tanggal)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

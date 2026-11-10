import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { EncounterStatus, ServiceType } from '../../../enums';

export class CreateEncounterDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  patientId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  practitionerId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  locationId?: number;

  @ApiPropertyOptional({
    description: 'ID reservasi yang di-check-in menjadi kunjungan ini',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  reservationId?: number;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;
}

export class UpdateEncounterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  patientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  practitionerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  locationId?: number;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;
}

export class UpdateEncounterStatusDto {
  @ApiProperty({ enum: EncounterStatus })
  @IsEnum(EncounterStatus)
  @IsNotEmpty()
  status: EncounterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class EncounterListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'Bulan (YYYY-MM). Bila diisi, daftar mencakup seluruh bulan itu (bukan hanya hari ini) dan respons memuat `days` (tanggal berisi kunjungan) serta `counts`.',
    example: '2026-10',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month harus berformat YYYY-MM, mis. 2026-10',
  })
  month?: string;

  @ApiPropertyOptional({
    description:
      'Jika true, hanya kunjungan Menunggu/Berlangsung (arrived + in_progress)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  practitionerId?: number;

  @ApiPropertyOptional({ enum: EncounterStatus })
  @IsOptional()
  @IsEnum(EncounterStatus)
  status?: EncounterStatus;

  @ApiPropertyOptional({
    description:
      'Jika true, hanya tampilkan encounter yang belum memiliki billing aktif, lintas semua tanggal (tidak dibatasi filter tanggal default)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unbilled?: boolean;

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

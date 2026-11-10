import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { BranchBillingMode } from '../entities/owner-clinic-link.entity';

export class LinkClinicDto {
  @ApiProperty({ description: 'ID klinik yang ditambahkan ke owner ini' })
  @IsInt()
  clinicId: number;

  @ApiPropertyOptional({
    description:
      'Cabang baru yang dibuat untuk owner ini: langsung terhubung tanpa persetujuan owner klinik',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  direct?: boolean;
}

export class RespondLinkDto {
  @ApiProperty({ description: 'true = setujui, false = tolak' })
  @IsBoolean()
  approve: boolean;
}

export class SetBillingModeDto {
  @ApiProperty({ enum: BranchBillingMode })
  @IsEnum(BranchBillingMode)
  billingMode: BranchBillingMode;
}

export class MultiClinicDashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Satu cabang saja; kosong = semua cabang',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clinicId?: number;
}

export class MultiClinicReportQueryDto extends MultiClinicDashboardQueryDto {
  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({ example: '2026-10-31' })
  @IsDateString()
  dateTo: string;
}

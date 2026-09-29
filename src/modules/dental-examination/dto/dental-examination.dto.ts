import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertDentalExaminationDto {
  @ApiPropertyOptional({ description: 'OHI-S — Debris Index (0-3)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(3)
  ohisDebris?: number;

  @ApiPropertyOptional({ description: 'OHI-S — Calculus Index (0-3)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(3)
  ohisCalculus?: number;

  @ApiPropertyOptional({ description: 'Gingival Index (Löe & Silness), 0-3' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(3)
  gingivalIndex?: number;

  @ApiPropertyOptional({
    description: 'Plaque Control Record — jumlah permukaan berplak',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plaqueSurfacesWithPlaque?: number;

  @ApiPropertyOptional({
    description: 'Plaque Control Record — jumlah permukaan diperiksa',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plaqueSurfacesExamined?: number;

  @ApiPropertyOptional({
    description:
      'Kedalaman poket per gigi (mm), array {toothNumber, buccal, lingual}',
  })
  @IsOptional()
  @IsArray()
  probingDepths?: { toothNumber: number; buccal?: number; lingual?: number }[];

  @ApiPropertyOptional({ description: 'Catatan tambahan' })
  @IsOptional()
  @IsString()
  notes?: string;
}

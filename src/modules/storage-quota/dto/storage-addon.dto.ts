import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PurchaseStorageDto {
  @ApiProperty({ example: 5, description: 'GB tambahan (1–100)' })
  @IsInt()
  @Min(1)
  gb: number;
}

export class AdjustStorageDto {
  @ApiPropertyOptional({ description: 'Klinik (klinik biasa)' })
  @IsOptional()
  @IsInt()
  clinicId?: number;

  @ApiPropertyOptional({ description: 'Owner multiklinik (jatah bersama)' })
  @IsOptional()
  @IsInt()
  ownerId?: number;

  @ApiProperty({
    example: -2,
    description: 'Positif menambah, negatif mengurangi (GB)',
  })
  @IsInt()
  gb: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @ApiPropertyOptional({
    description:
      'true = bonus gratis (tidak ditagih selama masa gratis); false/kosong = ditagih',
  })
  @IsOptional()
  @IsBoolean()
  free?: boolean;

  @ApiPropertyOptional({
    description:
      'Masa gratis bonus dalam bulan (1–36). Kosong/null = gratis selamanya',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  freeMonths?: number | null;
}

export class AddonListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ownerId?: number;
}

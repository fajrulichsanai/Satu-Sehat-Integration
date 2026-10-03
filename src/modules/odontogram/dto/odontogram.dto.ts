import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SURFACE_CONDITION_VALUES,
  TEKS_ATAS_VALUES,
  TEKS_BAWAH_VALUES,
} from '../odontogram.constants';

export class UpsertToothConditionDto {
  @ApiPropertyOptional({
    description: 'Teks anotasi di atas gigi',
    example: 'SOU',
    enum: TEKS_ATAS_VALUES,
  })
  @IsOptional()
  @IsIn(TEKS_ATAS_VALUES)
  teksAtas?: string;

  @ApiPropertyOptional({
    description: 'Teks anotasi di bawah gigi',
    example: 'MISSING',
    enum: TEKS_BAWAH_VALUES,
  })
  @IsOptional()
  @IsIn(TEKS_BAWAH_VALUES)
  teksBawah?: string;

  @ApiPropertyOptional({
    description: 'Riwayat perawatan saluran akar (Root Canal Treatment)',
  })
  @IsOptional()
  @IsBoolean()
  rct?: boolean;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Mesial',
    enum: SURFACE_CONDITION_VALUES,
  })
  @IsOptional()
  @IsIn(SURFACE_CONDITION_VALUES)
  surfaceMesial?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Distal',
    enum: SURFACE_CONDITION_VALUES,
  })
  @IsOptional()
  @IsIn(SURFACE_CONDITION_VALUES)
  surfaceDistal?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Vestibular',
    enum: SURFACE_CONDITION_VALUES,
  })
  @IsOptional()
  @IsIn(SURFACE_CONDITION_VALUES)
  surfaceVestibular?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Lingual/Palatal',
    enum: SURFACE_CONDITION_VALUES,
  })
  @IsOptional()
  @IsIn(SURFACE_CONDITION_VALUES)
  surfaceLingual?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Oklusal/Insisal',
    enum: SURFACE_CONDITION_VALUES,
  })
  @IsOptional()
  @IsIn(SURFACE_CONDITION_VALUES)
  surfaceOcclusal?: string;

  @ApiPropertyOptional({ description: 'Catatan tambahan untuk gigi ini' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDentalBridgeDto {
  @ApiProperty({ description: 'Nomor gigi awal (FDI)', example: 11 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(11)
  @Max(48)
  fromTooth: number;

  @ApiProperty({ description: 'Nomor gigi akhir (FDI)', example: 13 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(11)
  @Max(48)
  toTooth: number;

  @ApiPropertyOptional({
    description: 'Label/jenis',
    example: 'Gigi Tiruan Cekat',
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Catatan' })
  @IsOptional()
  @IsString()
  notes?: string;
}

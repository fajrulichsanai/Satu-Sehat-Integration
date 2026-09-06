import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertToothConditionDto {
  @ApiPropertyOptional({
    description: 'Kondisi keseluruhan gigi',
    example: 'missing',
    enum: [
      'missing',
      'root_remnant',
      'root_canal_treated',
      'crown',
      'impacted',
      'implant',
      'to_be_extracted',
      'unerupted',
    ],
  })
  @IsOptional()
  @IsString()
  wholeCondition?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Mesial',
    enum: ['caries', 'filling'],
  })
  @IsOptional()
  @IsString()
  surfaceMesial?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Distal',
    enum: ['caries', 'filling'],
  })
  @IsOptional()
  @IsString()
  surfaceDistal?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Vestibular',
    enum: ['caries', 'filling'],
  })
  @IsOptional()
  @IsString()
  surfaceVestibular?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Lingual/Palatal',
    enum: ['caries', 'filling'],
  })
  @IsOptional()
  @IsString()
  surfaceLingual?: string;

  @ApiPropertyOptional({
    description: 'Kondisi permukaan Oklusal/Insisal',
    enum: ['caries', 'filling'],
  })
  @IsOptional()
  @IsString()
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

import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTarifDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string | undefined;

  @ApiProperty({ example: 'konsultasi' })
  @IsString()
  @IsNotEmpty()
  kategori: string | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kodeIcd9?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hargaPokok?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  hargaJual: number | undefined;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  diskonMaksimal?: number;
}

export class UpdateTarifDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kategori?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kodeIcd9?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  hargaPokok?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  hargaJual?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  diskonMaksimal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TarifQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kategori?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}

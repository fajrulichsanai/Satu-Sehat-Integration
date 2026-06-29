import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOperationalRecordDto {
  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  tanggal: string;

  @ApiProperty({ example: 'listrik' })
  @IsNotEmpty()
  @MaxLength(50)
  kategori: string;

  @ApiProperty({ example: 'Pembayaran listrik bulanan' })
  @IsNotEmpty()
  @IsString()
  deskripsi: string;

  @ApiProperty({ example: 1250000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nominal: number;
}

export class UpdateOperationalRecordDto {
  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  tanggal?: string;

  @ApiPropertyOptional({ example: 'listrik' })
  @IsOptional()
  @MaxLength(50)
  kategori?: string;

  @ApiPropertyOptional({ example: 'Pembayaran listrik bulanan' })
  @IsOptional()
  @IsString()
  deskripsi?: string;

  @ApiPropertyOptional({ example: 1250000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nominal?: number;
}

export class OperationalRecordListQueryDto {
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
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 50;
}

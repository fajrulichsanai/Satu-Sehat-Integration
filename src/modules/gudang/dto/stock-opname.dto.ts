import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class StockOpnameItemDto {
  @ApiProperty()
  @IsInt()
  barangId: number;

  @ApiProperty({ description: 'Jumlah fisik hasil hitung (satuan pakai)' })
  @IsInt()
  @Min(0)
  stokFisik: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  catatan?: string;
}

export class CreateStockOpnameDto {
  @ApiProperty({ example: '2026-10-15' })
  @IsDateString()
  tanggal: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @ApiProperty({ type: [StockOpnameItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => StockOpnameItemDto)
  items: StockOpnameItemDto[];
}

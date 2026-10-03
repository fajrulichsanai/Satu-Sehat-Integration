import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePrescriptionItemDto {
  @ApiProperty({ description: 'Nama obat', example: 'Amoxicillin 500mg' })
  @IsNotEmpty()
  @IsString()
  drugName: string;

  @ApiPropertyOptional({
    description: 'Kode KFA produk obat (8 digit), dari pencarian KFA',
    example: '93002013',
  })
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Kode KFA harus 8 digit angka' })
  kfaCode?: string;

  @ApiPropertyOptional({ description: 'Nama produk menurut KFA' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  kfaName?: string;

  @ApiPropertyOptional({ description: 'Dosis', example: '500 mg' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: 'Frekuensi', example: '3x sehari' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({ description: 'Durasi', example: '5 hari' })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ description: 'Jumlah', example: '15 tablet' })
  @IsOptional()
  @IsString()
  quantity?: string;

  @ApiPropertyOptional({
    description: 'Aturan pakai',
    example: 'Sesudah makan',
  })
  @IsOptional()
  @IsString()
  instructions?: string;
}

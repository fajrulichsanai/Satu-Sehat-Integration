import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePrescriptionItemDto {
  @ApiProperty({ description: 'Nama obat', example: 'Amoxicillin 500mg' })
  @IsNotEmpty()
  @IsString()
  drugName: string;

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

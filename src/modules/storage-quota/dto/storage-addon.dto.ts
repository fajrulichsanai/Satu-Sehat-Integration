import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

  @ApiProperty({ example: -2, description: 'Positif menambah, negatif mengurangi (GB)' })
  @IsInt()
  gb: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

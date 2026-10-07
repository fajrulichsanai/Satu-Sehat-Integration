import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  IMMUNIZATION_ROUTE_CODES,
  IMMUNIZATION_SITE_CODES,
} from '../immunization-codes';

export class CreateImmunizationDto {
  @ApiProperty({
    description: 'Kode produk KFA vaksin (93…)',
    example: '93000123',
  })
  @Matches(/^93\d{6}$/, {
    message: 'Vaksin wajib memakai kode produk KFA (93…, 8 digit)',
  })
  kfaCode: string;

  @ApiProperty({ example: 'Vaksin Hepatitis B 0,5 mL' })
  @IsString()
  @MaxLength(255)
  vaccineName: string;

  @ApiProperty({ description: 'Dosis ke-', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  doseNumber: number;

  @ApiPropertyOptional({ description: 'Volume per dosis (mL)', example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10)
  doseMl?: number | null;

  @ApiPropertyOptional({ enum: IMMUNIZATION_ROUTE_CODES })
  @IsOptional()
  @IsIn(IMMUNIZATION_ROUTE_CODES)
  route?: string | null;

  @ApiPropertyOptional({ enum: IMMUNIZATION_SITE_CODES })
  @IsOptional()
  @IsIn(IMMUNIZATION_SITE_CODES)
  site?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lotNumber?: string | null;

  @ApiPropertyOptional({ example: '2027-12-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expirationDate?: string | null;

  @ApiPropertyOptional({ description: 'Waktu pemberian (default sekarang)' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}

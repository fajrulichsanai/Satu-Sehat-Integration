import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SetFeatureDto {
  @ApiProperty({ example: 'gudang' })
  @IsString()
  @MaxLength(60)
  featureKey: string;

  @ApiProperty({
    nullable: true,
    description: 'true = nyala, false = mati, null = kembali ke bawaan',
  })
  @ValidateIf((o: SetFeatureDto) => o.enabled !== null)
  @IsBoolean()
  enabled: boolean | null;
}

export class CreateCustomFeatureDto {
  @ApiProperty({
    example: 'laporan-bpjs',
    description: 'Huruf kecil, angka, tanda hubung',
  })
  @Matches(/^[a-z0-9][a-z0-9-]{1,48}$/, {
    message: 'Kunci hanya huruf kecil, angka, dan tanda hubung (2–49 karakter)',
  })
  key: string;

  @ApiProperty({ example: 'Laporan BPJS' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength, ValidateIf } from 'class-validator';

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

export class SetEnabledDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}

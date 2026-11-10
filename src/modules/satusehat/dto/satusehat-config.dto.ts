import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SatusehatEnvironment } from '../../../enums/satusehat-environment.enum';

export class SaveSatusehatConfigDto {
  @ApiProperty({
    example: '100025702',
    description: 'Organization ID SATUSEHAT',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  organizationId: string;

  @ApiProperty({ description: 'Client ID dari portal SATUSEHAT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  clientId: string;

  @ApiPropertyOptional({
    description:
      'Client secret. Kosongkan untuk mempertahankan secret yang tersimpan.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  clientSecret?: string;

  @ApiProperty({ enum: SatusehatEnvironment })
  @IsEnum(SatusehatEnvironment)
  environment: SatusehatEnvironment;

  @ApiPropertyOptional({
    description:
      'Location ID SATUSEHAT untuk Poli Gigi — dipakai bila kunjungan tidak punya ruangan',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  poliLocationId?: string;
}

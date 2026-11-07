import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePhotoTemplateGroupDto {
  @ApiProperty({ description: 'Nama folder', example: 'Bedah Minor' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;
}

export class UpdatePhotoTemplateGroupDto {
  @ApiPropertyOptional({ description: 'Nama folder' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Urutan tampil' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Aktif/nonaktif' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePhotoTemplateDto {
  @ApiProperty({ description: 'Nama slot', example: 'Pre-op' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Urutan tampil' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePhotoTemplateDto {
  @ApiPropertyOptional({ description: 'Nama slot' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Urutan tampil' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Aktif/nonaktif' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

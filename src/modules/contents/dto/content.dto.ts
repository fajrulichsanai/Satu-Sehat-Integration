import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ContentBackground,
  ContentLayout,
  ContentStatus,
} from '../entities/clinic-content.entity';

export class ContentPhotoFrameDto {
  @IsNumber()
  @Min(1)
  @Max(3)
  zoom: number;

  @IsNumber()
  @Min(-5000)
  @Max(5000)
  ox: number;

  @IsNumber()
  @Min(-5000)
  @Max(5000)
  oy: number;
}

export class ContentSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ContentPhotoFrameDto)
  before?: ContentPhotoFrameDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContentPhotoFrameDto)
  after?: ContentPhotoFrameDto;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  brandSub?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  badge?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  handle?: string;
}

/** Fields shared by create and update; every one is optional on update. */
class ContentFieldsDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  caption?: string;

  @ApiPropertyOptional({ enum: ContentLayout })
  @IsOptional()
  @IsEnum(ContentLayout)
  layout?: ContentLayout;

  @ApiPropertyOptional({ enum: ContentBackground })
  @IsOptional()
  @IsEnum(ContentBackground)
  background?: ContentBackground;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showDisclaimer?: boolean;

  @ApiPropertyOptional({ description: 'URL returned by POST /contents/images' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  beforeImageUrl?: string | null;

  @ApiPropertyOptional({ description: 'URL returned by POST /contents/images' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  afterImageUrl?: string | null;

  @ApiPropertyOptional({ type: ContentSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContentSettingsDto)
  settings?: ContentSettingsDto;
}

export class CreateContentDto extends ContentFieldsDto {
  @ApiProperty({ maxLength: 64, example: 'Scaling & Polishing' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  title: string;
}

export class UpdateContentDto extends ContentFieldsDto {
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  title?: string;
}

export class ContentQueryDto {
  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

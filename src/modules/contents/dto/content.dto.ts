import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Matches,
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
  @Max(5)
  zoom: number;

  @IsNumber()
  @Min(-5000)
  @Max(5000)
  ox: number;

  @IsNumber()
  @Min(-5000)
  @Max(5000)
  oy: number;

  @IsOptional()
  @IsNumber()
  @Min(-360)
  @Max(360)
  rot?: number;

  @IsOptional()
  @IsBoolean()
  flip?: boolean;
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

  @IsOptional()
  @IsString()
  @MaxLength(40)
  template?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @Matches(/^[1-8][1-8]$/, { each: true, message: 'Nomor gigi harus format FDI, mis. 11' })
  teeth?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  condition?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  visits?: number;

  @IsOptional()
  @IsBoolean()
  autoCaption?: boolean;
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

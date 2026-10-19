import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ContentPhotoSource } from '../entities/content-photo.entity';

export class AddContentPhotoDto {
  @ApiProperty({ enum: ContentPhotoSource })
  @IsEnum(ContentPhotoSource)
  sourceType: ContentPhotoSource;

  @ApiProperty({
    description:
      'id foto (patient_photos.id) atau gambar penunjang (supporting_exam_images.id), sesuai sourceType',
  })
  @IsInt()
  @Min(1)
  sourceId: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  caption?: string;

  @ApiPropertyOptional({ description: 'Blur wajah di foto ini (opsional, bukan paksaan)' })
  @IsOptional()
  @IsBoolean()
  blurFace?: boolean;
}

export class ReorderContentPhotosDto {
  @ApiProperty({ type: [Number], description: 'id content_photos sesuai urutan baru' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  orderedIds: number[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  SupportingExamImageCategory,
  SupportingExamImageType,
} from '../entities/supporting-exam-image.entity';

export class CreateSupportingExamImageDto {
  @ApiProperty({
    description: 'Jenis gambar',
    enum: SupportingExamImageType,
    example: SupportingExamImageType.PHOTO,
  })
  @IsNotEmpty()
  @IsEnum(SupportingExamImageType)
  imageType: SupportingExamImageType;

  @ApiPropertyOptional({
    description: 'Kategori foto klinis (hanya relevan untuk imageType photo)',
    enum: SupportingExamImageCategory,
  })
  @IsOptional()
  @IsEnum(SupportingExamImageCategory)
  category?: SupportingExamImageCategory;

  @ApiPropertyOptional({ description: 'Catatan' })
  @IsOptional()
  @IsString()
  notes?: string;
}

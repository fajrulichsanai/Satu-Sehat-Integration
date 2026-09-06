import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SupportingExamImageType } from '../entities/supporting-exam-image.entity';

export class CreateSupportingExamImageDto {
  @ApiProperty({
    description: 'Jenis gambar',
    enum: SupportingExamImageType,
    example: SupportingExamImageType.PHOTO,
  })
  @IsNotEmpty()
  @IsEnum(SupportingExamImageType)
  imageType: SupportingExamImageType;

  @ApiPropertyOptional({ description: 'Catatan' })
  @IsOptional()
  @IsString()
  notes?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadPatientPhotoDto {
  @ApiPropertyOptional({ description: 'Slot folder (photo_templates.id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional({ description: 'Ukuran asli sebelum dikompres (bytes)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  originalSizeBytes?: number;
}

export class SetPhotoConsentDto {
  @ApiPropertyOptional({
    description:
      'true = boleh dipakai konten, false = tidak boleh, null/absen = batal (belum diputuskan)',
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  consent?: boolean | null;
}

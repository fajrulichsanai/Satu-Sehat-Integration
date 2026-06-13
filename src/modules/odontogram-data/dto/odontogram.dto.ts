import { IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToothDataDto {
  surfaces?: {
    buccal?: string | null;
    palatal?: string | null;
    mesial?: string | null;
    distal?: string | null;
    occlusal?: string | null;
  };
  statusAbove?: string | null;
  statusBelow?: string | null;
  isRCT?: boolean;
}

export class UpsertOdontogramDto {
  @ApiProperty({ description: 'Tooth data keyed by FDI number (e.g. "16", "11")' })
  @IsObject()
  teeth: Record<string, ToothDataDto>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  additionalFindings?: {
    occlusion?: string | null;
    diastema?: boolean;
    anomaly?: string | null;
  };
}

import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertEncounterSoapNoteDto {
  @ApiPropertyOptional({ description: 'Subjective - keluhan/cerita pasien' })
  @IsOptional()
  @IsString()
  subjective?: string;

  @ApiPropertyOptional({ description: 'Objective - hasil pemeriksaan' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ description: 'Assessment - diagnosis/penilaian' })
  @IsOptional()
  @IsString()
  assessment?: string;

  @ApiPropertyOptional({ description: 'Plan - rencana tindakan/terapi' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({ description: 'Tanda tangan dokter (base64 PNG data URL)' })
  @IsOptional()
  @IsString()
  signature?: string;
}

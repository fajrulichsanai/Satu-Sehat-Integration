import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertPhysicalExaminationDto {
  @ApiPropertyOptional({ description: 'Keadaan umum', example: 'Tampak sakit sedang' })
  @IsOptional()
  @IsString()
  generalCondition?: string;

  @ApiPropertyOptional({ description: 'Kesadaran', example: 'Komposmentis' })
  @IsOptional()
  @IsString()
  consciousness?: string;

  @ApiPropertyOptional({ description: 'Tekanan darah sistolik (mmHg)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bloodPressureSystolic?: number;

  @ApiPropertyOptional({ description: 'Tekanan darah diastolik (mmHg)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bloodPressureDiastolic?: number;

  @ApiPropertyOptional({ description: 'Frekuensi nadi (x/menit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pulseRate?: number;

  @ApiPropertyOptional({ description: 'Frekuensi napas (x/menit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'Suhu tubuh (°C)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Saturasi oksigen / SpO2 (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  oxygenSaturation?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() cyanosis?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() edema?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() anemia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jaundice?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() skin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lymphNodes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() head?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() hair?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eyes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ears?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nose?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mouth?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() neck?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() lungInspection?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lungPalpation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lungPercussion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lungAuscultation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() heartInspection?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heartPalpation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heartPercussion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() heartAuscultation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() abdomenInspection?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() abdomenPalpation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() abdomenPercussion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() abdomenAuscultation?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() extremities?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() genitalia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rectal?: string;
}

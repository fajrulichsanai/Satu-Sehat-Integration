import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PREGNANCY_STATUSES,
  PSYCHOLOGICAL_STATUSES,
  SMOKING_STATUSES,
} from '../entities/physical-examination.entity';
import type {
  PregnancyStatus,
  PsychologicalStatus,
  SmokingStatus,
} from '../entities/physical-examination.entity';

export class UpsertPhysicalExaminationDto {
  @ApiPropertyOptional({
    description: 'Keadaan umum',
    example: 'Tampak sakit sedang',
  })
  @IsOptional()
  @IsString()
  generalCondition?: string;

  @ApiPropertyOptional({ description: 'Kesadaran', example: 'Komposmentis' })
  @IsOptional()
  @IsString()
  consciousness?: string;

  @ApiPropertyOptional({ description: 'Status gizi', example: 'Gizi baik' })
  @IsOptional()
  @IsString()
  nutritionalStatus?: string;

  @ApiPropertyOptional({ description: 'Tinggi badan (cm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(300)
  height?: number;

  @ApiPropertyOptional({ description: 'Berat badan (kg)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  weight?: number;

  @ApiPropertyOptional({ description: 'Skala nyeri (0-10)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  painScale?: number;

  @ApiPropertyOptional({
    description: 'Titik lokasi nyeri pada diagram tubuh (persen x/y)',
  })
  @IsOptional()
  @IsArray()
  painPoints?: { x: number; y: number }[];

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

  @ApiPropertyOptional({
    enum: PSYCHOLOGICAL_STATUSES,
    description: 'Status psikologis',
  })
  @IsOptional()
  @IsIn(PSYCHOLOGICAL_STATUSES)
  psychologicalStatus?: PsychologicalStatus | null;

  @ApiPropertyOptional({
    description: 'Keterangan status psikologis (mis. bila "lainnya")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  psychologicalNote?: string | null;

  @ApiPropertyOptional({
    enum: PREGNANCY_STATUSES,
    description: 'Status kehamilan (pasien perempuan)',
  })
  @IsOptional()
  @IsIn(PREGNANCY_STATUSES)
  pregnancyStatus?: PregnancyStatus | null;

  // Rentang di bawah = nilai yang masuk akal secara klinis; di luar itu
  // hampir pasti salah ketik dan akan ditolak sebelum dikirim ke SATUSEHAT.
  @ApiPropertyOptional({ description: 'Lingkar perut (cm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(250)
  waistCircumference?: number | null;

  @ApiPropertyOptional({ description: 'Lingkar kepala (cm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(20)
  @Max(70)
  headCircumference?: number | null;

  @ApiPropertyOptional({ description: 'Glasgow Coma Scale total (3–15)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(15)
  gcsTotal?: number | null;

  @ApiPropertyOptional({
    description: 'Gula darah sewaktu, glukometer (mg/dL)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(1000)
  bloodGlucose?: number | null;

  @ApiPropertyOptional({
    enum: SMOKING_STATUSES,
    description: 'Status merokok',
  })
  @IsOptional()
  @IsIn(SMOKING_STATUSES)
  smokingStatus?: SmokingStatus | null;

  @ApiPropertyOptional({
    description: 'Temuan lain yang tidak ada kolomnya di form pemeriksaan',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  otherFindings?: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  FASTING_STATUSES,
  LAB_ORDER_STATUSES,
} from '../entities/lab-order.entity';
import type {
  FastingStatus,
  LabOrderStatus,
} from '../entities/lab-order.entity';
import { LAB_INTERPRETATIONS } from '../entities/lab-result.entity';
import type { LabInterpretation } from '../entities/lab-result.entity';
import {
  MODALITIES,
  RADIOLOGY_STATUSES,
} from '../entities/radiology-order.entity';
import type {
  Modality,
  RadiologyStatus,
} from '../entities/radiology-order.entity';

export class CreateLabOrderDto {
  @ApiProperty({
    description: 'Kode pemeriksaan dari katalog lab (kategori Permintaan)',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ description: 'Jenis spesimen, default dari katalog' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  specimenType?: string;

  @ApiPropertyOptional({ enum: FASTING_STATUSES })
  @IsOptional()
  @IsIn(FASTING_STATUSES)
  fasting?: FastingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateLabOrderDto {
  @ApiPropertyOptional({ enum: LAB_ORDER_STATUSES })
  @IsOptional()
  @IsIn(LAB_ORDER_STATUSES)
  status?: LabOrderStatus;

  @ApiPropertyOptional({ enum: FASTING_STATUSES })
  @IsOptional()
  @IsIn(FASTING_STATUSES)
  fasting?: FastingStatus;

  @ApiPropertyOptional({ description: 'Waktu pengambilan spesimen (ISO)' })
  @IsOptional()
  @IsDateString()
  specimenCollectedAt?: string;

  @ApiPropertyOptional({ description: 'Kesimpulan laporan lab' })
  @IsOptional()
  @IsString()
  conclusion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class LabResultDto {
  @ApiProperty({ description: 'Kode parameter hasil (kategori Hasil)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ description: 'Nilai kuantitatif' })
  @IsOptional()
  @IsNumber()
  valueNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Kode jawaban (answer list) untuk hasil nominal/ordinal',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  valueCode?: string;

  @ApiPropertyOptional({ description: 'Hasil naratif / teks' })
  @IsOptional()
  @IsString()
  valueText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  refLow?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  refHigh?: number;

  @ApiPropertyOptional({ enum: LAB_INTERPRETATIONS })
  @IsOptional()
  @IsIn(LAB_INTERPRETATIONS)
  interpretation?: LabInterpretation;
}

export class SaveLabResultsDto {
  @ApiProperty({ type: [LabResultDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabResultDto)
  results: LabResultDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conclusion?: string;
}

export class CreateRadiologyOrderDto {
  @ApiProperty({ description: 'Kode pemeriksaan dari katalog radiologi' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({
    enum: MODALITIES,
    description: 'Default ditebak dari jenis pemeriksaan',
  })
  @IsOptional()
  @IsIn(MODALITIES)
  modality?: Modality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateRadiologyOrderDto {
  @ApiPropertyOptional({ enum: RADIOLOGY_STATUSES })
  @IsOptional()
  @IsIn(RADIOLOGY_STATUSES)
  status?: RadiologyStatus;

  @ApiPropertyOptional({ description: 'Bacaan/hasil radiologi' })
  @IsOptional()
  @IsString()
  resultText?: string;

  @ApiPropertyOptional({ description: 'Kesimpulan/kesan' })
  @IsOptional()
  @IsString()
  conclusion?: string;

  @ApiPropertyOptional({ enum: MODALITIES })
  @IsOptional()
  @IsIn(MODALITIES)
  modality?: Modality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

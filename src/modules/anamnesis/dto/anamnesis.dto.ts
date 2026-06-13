import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AllergyLevel } from '../../allergy/entities/allergy.entity';
import { BloodType, PregnancyStatus, Rhesus } from '../entities/anamnesis.entity';

export class AllergyItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  substansi: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reaksi: string;

  @ApiProperty({ enum: AllergyLevel })
  @IsEnum(AllergyLevel)
  tingkat: AllergyLevel;
}

export class MedicationHistoryItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  namaObat: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dosis: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  frekuensi: string;
}

export class UpsertAnamnesisDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  keluhanUtama: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riwayatPenyakit?: string;

  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  golonganDarah?: BloodType;

  @ApiPropertyOptional({ enum: Rhesus })
  @IsOptional()
  @IsEnum(Rhesus)
  rhesus?: Rhesus;

  @ApiPropertyOptional({ enum: PregnancyStatus })
  @IsOptional()
  @IsEnum(PregnancyStatus)
  statusKehamilan?: PregnancyStatus;

  @ApiPropertyOptional({ type: [AllergyItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergyItemDto)
  alergi?: AllergyItemDto[];

  @ApiPropertyOptional({ type: [MedicationHistoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationHistoryItemDto)
  riwayatObat?: MedicationHistoryItemDto[];
}

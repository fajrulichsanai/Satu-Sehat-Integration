import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DurationUnit } from '../../../entities/prescription.entity';

export class CreatePrescriptionDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  medicationId: number;

  @ApiProperty({ example: '3x1 kapsul sesudah makan' })
  @IsString()
  @IsNotEmpty()
  dosageInstruction: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ enum: DurationUnit })
  @IsOptional()
  @IsEnum(DurationUnit)
  durationUnit?: DurationUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

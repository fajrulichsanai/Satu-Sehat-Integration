import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FeeType } from '../entities/doctor-fee-config.entity';

export class UpsertDoctorFeeConfigDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  tarifId: number;

  @ApiProperty({ enum: FeeType, example: FeeType.PERCENTAGE })
  @IsEnum(FeeType)
  feeType: FeeType;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @Min(0)
  feeValue: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

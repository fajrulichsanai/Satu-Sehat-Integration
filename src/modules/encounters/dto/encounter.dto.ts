import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EncounterStatus, ServiceType } from '../../../enums';

export class CreateEncounterDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  patientId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  practitionerId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  locationId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  queueId?: number;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;
}

export class UpdateEncounterStatusDto {
  @ApiProperty({ enum: EncounterStatus })
  @IsEnum(EncounterStatus)
  @IsNotEmpty()
  status: EncounterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class EncounterListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  practitionerId?: number;

  @ApiPropertyOptional({ enum: EncounterStatus })
  @IsOptional()
  @IsEnum(EncounterStatus)
  status?: EncounterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

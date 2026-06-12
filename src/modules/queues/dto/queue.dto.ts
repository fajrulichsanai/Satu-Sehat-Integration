import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QueueStatus, ServiceType } from '../../../enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export enum QueueType {
  WALK_IN = 'walk_in',
  BOOKING = 'booking',
}

export class CreateQueueDto {
  @ApiPropertyOptional({ description: 'Patient ID (null for walk-in without registered patient)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @ApiProperty({ example: 'Budi Santoso', description: 'Patient name (required for walk-in without patientId)' })
  @IsNotEmpty()
  @MaxLength(100)
  patientName: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  practitionerId: number;

  @ApiProperty({ example: '2026-06-12' })
  @IsDateString()
  @IsNotEmpty()
  appointmentDate: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  jamSlot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isFirstVisit?: boolean;
}

export class UpdateQueueStatusDto {
  @ApiProperty({ enum: QueueStatus })
  @IsEnum(QueueStatus)
  @IsNotEmpty()
  status: QueueStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancelledReason?: string;
}

export class QueueQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: '2026-06-12', description: 'Filter by date (default: today)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ enum: QueueStatus })
  @IsOptional()
  @IsEnum(QueueStatus)
  status?: QueueStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practitionerId?: number;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}

export class SlotsQueryDto {
  @ApiProperty({ example: '2026-06-12' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practitionerId?: number;
}

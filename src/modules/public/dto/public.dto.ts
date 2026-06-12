import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { ServiceType } from '../../../enums';
import { IsValidNIK } from '../../../common/validators/nik.validator';

export class ClinicInfoQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number;
}

export class AvailableSlotsQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  clinicId: number;

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

export class BookingDto {
  @ApiProperty({ example: '3171234567890001' })
  @IsValidNIK()
  @IsNotEmpty()
  patientNik: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsNotEmpty()
  @MaxLength(100)
  patientName: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @MaxLength(20)
  patientPhone?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  clinicId: number;

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

  @ApiProperty({ example: '2026-06-12' })
  @IsDateString()
  @IsNotEmpty()
  appointmentDate: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  jamSlot?: string;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}

export class QueueStatusQueryDto {
  @ApiProperty({ example: 'AB12CD34' })
  @IsNotEmpty()
  @IsString()
  token: string;
}

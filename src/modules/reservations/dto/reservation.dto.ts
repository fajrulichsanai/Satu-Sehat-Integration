import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationStatus, ServiceType } from '../../../enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { IsValidNIK } from '../../../common/validators/nik.validator';

export class CreateReservationDto {
  @ApiPropertyOptional({ description: 'Patient ID jika sudah terdaftar' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsNotEmpty()
  @MaxLength(100)
  patientName: string;

  @ApiPropertyOptional({
    example: '08123456789',
    description:
      'Wajib diisi untuk entri manual (tanpa patientId). Jika patientId diisi, akan diambil otomatis dari data pasien bila dikosongkan.',
  })
  @ValidateIf((o: CreateReservationDto) => !o.patientId)
  @IsNotEmpty({ message: 'Nomor telepon wajib diisi' })
  @MaxLength(20)
  patientPhone?: string;

  @ApiPropertyOptional({ example: '3171234567890001' })
  @IsOptional()
  @IsValidNIK()
  patientNik?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practitionerId?: number;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiProperty({ example: '2026-06-12' })
  @IsDateString()
  @IsNotEmpty()
  reservationDate: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  jamSlot?: string;

  @ApiPropertyOptional({ description: 'Catatan atau keluhan pasien' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PublicCreateReservationDto extends CreateReservationDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  clinicId: number;
}

export class UpdateReservationStatusDto {
  @ApiProperty({ enum: ReservationStatus })
  @IsEnum(ReservationStatus)
  @IsNotEmpty()
  status: ReservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancelledReason?: string;
}

export class RescheduleReservationDto {
  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  @IsNotEmpty()
  reservationDate: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  jamSlot?: string;
}

export class ReservationQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: '2026-06-12',
    description: 'Filter berdasarkan tanggal reservasi',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: '2026-06-12',
    description: 'Filter reservasi mulai tanggal ini (inklusif)',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practitionerId?: number;

  @ApiPropertyOptional({
    description: 'Cari berdasarkan nama atau nomor telepon pasien',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class LinkPatientDto {
  @ApiProperty({ description: 'ID pasien yang baru didaftarkan' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  patientId: number;
}

export class PublicReservationStatusQueryDto {
  @ApiProperty({ example: 'AB12CD34' })
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class PublicAvailableSlotsQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  clinicId: number;

  @ApiProperty({ example: '2026-07-15' })
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

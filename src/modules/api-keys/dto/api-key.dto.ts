import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiKeyType } from '../entities/api-key.entity';
import { IsValidNIK } from '../../../common/validators/nik.validator';

/** scheme://host[:port], no path — what browsers send in the Origin header. */
const ORIGIN_PATTERN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?\/?$/i;

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Website klinik' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ApiKeyType })
  @IsEnum(ApiKeyType)
  type: ApiKeyType;

  @ApiPropertyOptional({ example: ['https://klinik-saya.web.app'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(ORIGIN_PATTERN, {
    each: true,
    message: 'Domain harus berbentuk https://nama-domain (tanpa path)',
  })
  allowedOrigins?: string[];

  /** Super Admin only: which clinic the key belongs to. Owners are fixed to their own clinic. */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number;
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: ['https://klinik-saya.web.app'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(ORIGIN_PATTERN, {
    each: true,
    message: 'Domain harus berbentuk https://nama-domain (tanpa path)',
  })
  allowedOrigins?: string[];
}

export class ApiKeyScopeQueryDto {
  /** Super Admin only. */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number;
}

// ----- public API (/v1) -----

export class ApiSlotsQueryDto {
  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practitionerId?: number;
}

/** Reservation from a website or partner system. Deliberately has no
 * patientId: an API caller must never attach a booking to an existing
 * patient record. */
export class ApiCreateReservationDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  patientName: string;

  @ApiProperty({ example: '08123456789' })
  @IsString()
  @IsNotEmpty({ message: 'Nomor telepon wajib diisi' })
  @MaxLength(20)
  patientPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsValidNIK()
  patientNik?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  practitionerId?: number;

  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  reservationDate: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'jamSlot harus berformat HH:MM' })
  jamSlot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Find a patient's own upcoming reservations without the token. Both
 * fields must match what was entered at booking — the phone number alone
 * is too easy to guess to reveal someone's appointment. */
export class ApiLookupReservationDto {
  @ApiProperty({ example: '08123456789' })
  @IsString()
  @IsNotEmpty({ message: 'Nomor telepon wajib diisi' })
  @MaxLength(20)
  patientPhone: string;

  @ApiProperty({
    example: 'Budi Santoso',
    description:
      'Nama pasien; nama depan saja cukup, huruf besar/kecil & sapaan (Ibu/Pak) diabaikan',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(100)
  patientName: string;
}

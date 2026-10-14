import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { DayMode } from '../attendance-rules';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Dikirim bersama foto (multipart) saat absen masuk / pulang */
export class ClockDto {
  @ApiPropertyOptional({ example: -6.2001234 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 106.8166667 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 18, description: 'Akurasi GPS (meter)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  accuracy?: number;

  @ApiProperty({ description: 'Penanda acak perangkat dari browser' })
  @IsString()
  @MinLength(16)
  @MaxLength(100)
  deviceToken: string;

  @ApiPropertyOptional({ example: 'Android · Chrome' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}

export class MonthQueryDto {
  @ApiPropertyOptional({ example: '2026-10' })
  @IsOptional()
  @Matches(MONTH, { message: 'Bulan harus berformat YYYY-MM' })
  month?: string;
}

export class CorrectionDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({ example: '2026-10-14' })
  @Matches(DATE, { message: 'Tanggal harus berformat YYYY-MM-DD' })
  workDate: string;

  @ApiProperty({ example: '08:05' })
  @Matches(HHMM, { message: 'Jam masuk harus berformat HH:mm' })
  clockIn: string;

  @ApiPropertyOptional({ example: '16:00', nullable: true })
  @IsOptional()
  @ValidateIf((o: CorrectionDto) => o.clockOut !== null)
  @Matches(HHMM, { message: 'Jam pulang harus berformat HH:mm' })
  clockOut?: string | null;

  @ApiProperty({ example: 'Lupa absen pulang, dikonfirmasi lewat WhatsApp' })
  @IsString()
  @IsNotEmpty({ message: 'Alasan koreksi wajib diisi' })
  @MaxLength(255)
  reason: string;
}

export class SettingsDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  toleranceMinutes: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(5000)
  radiusM: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: SettingsDto) => o.latitude !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o: SettingsDto) => o.longitude !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;
}

export class DayScheduleDto {
  @ApiProperty({ enum: ['work', 'off', 'flexible'] })
  @IsIn(['work', 'off', 'flexible'])
  mode: DayMode;

  @ApiPropertyOptional({ example: '08:00', nullable: true })
  @ValidateIf((o: DayScheduleDto) => o.mode === 'work')
  @Matches(HHMM, { message: 'Jam mulai harus berformat HH:mm' })
  start?: string | null;

  @ApiPropertyOptional({ example: '16:00', nullable: true })
  @ValidateIf((o: DayScheduleDto) => o.mode === 'work')
  @Matches(HHMM, { message: 'Jam selesai harus berformat HH:mm' })
  end?: string | null;
}

/** Jadwal seminggu: indeks 0 = Minggu … 6 = Sabtu */
export class WeekScheduleDto {
  @ApiProperty({ type: [DayScheduleDto] })
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayScheduleDto)
  days: DayScheduleDto[];
}

/** Jadwal khusus pegawai; `days: null` = kembali ke jadwal bawaan klinik */
export class UserScheduleDto {
  @ApiPropertyOptional({ type: [DayScheduleDto], nullable: true })
  @ValidateIf((o: UserScheduleDto) => o.days !== null)
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayScheduleDto)
  days: DayScheduleDto[] | null;
}

export class ClinicDeviceDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(100)
  deviceToken: string;

  @ApiPropertyOptional({ example: 'Tablet meja depan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}

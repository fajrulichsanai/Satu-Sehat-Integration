import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProvinceDto {
  code: string;
  parent_code: string;
  bps_code: string;
  name: string;
}

export class CityDto {
  code: string;
  parent_code: string;
  bps_code: string;
  name: string;
}

export class DistrictDto {
  code: string;
  parent_code: string;
  bps_code: string;
  name: string;
}

export class SubDistrictDto {
  code: string;
  parent_code: string;
  bps_code: string;
  name: string;
}

export class MasterDataResponseDto<T> {
  status: number;
  error: boolean;
  message: string;
  data: T[];
}

// ── Master Sarana Index (MSI) ──────────────────────────────────────────
// Ref: https://satusehat.kemkes.go.id/platform/docs/id/master-data/master-sarana-index/rest-api-msi/

export enum JenisSarana {
  PRAKTIK_MANDIRI = 101,
  PUSKESMAS = 102,
  KLINIK = 103,
  RUMAH_SAKIT = 104,
}

export enum StatusSarana {
  DRAFT = 'draft',
  VERIFIED = 'verified',
  VALID = 'valid',
  REVERIFIED = 'reverified',
}

/** Query params diteruskan apa adanya ke endpoint MSI SATUSEHAT. */
export class SearchSaranaQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit = 20;

  @ApiPropertyOptional({
    enum: JenisSarana,
    description:
      '101 Praktik Mandiri, 102 Puskesmas, 103 Klinik, 104 Rumah Sakit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(JenisSarana)
  jenis_sarana?: JenisSarana;

  @ApiPropertyOptional({ description: 'Kode SATUSEHAT (10 digit)' })
  @IsOptional()
  @Matches(/^\d{10}$/, { message: 'kode_satusehat harus 10 digit angka' })
  kode_satusehat?: string;

  @ApiPropertyOptional({ description: 'Kode sarana (mis. kode Kemenkes)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  kode_sarana?: string;

  @ApiPropertyOptional({ description: 'Nama sarana' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nama?: string;

  @ApiPropertyOptional({ description: 'Kode provinsi (2 digit)' })
  @IsOptional()
  @Matches(/^\d{2}$/, { message: 'kode_provinsi harus 2 digit angka' })
  kode_provinsi?: string;

  @ApiPropertyOptional({ description: 'Kode kab/kota (4 digit)' })
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'kode_kabkota harus 4 digit angka' })
  kode_kabkota?: string;

  @ApiPropertyOptional({ description: 'Kode kecamatan (6 digit)' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'kode_kecamatan harus 6 digit angka' })
  kode_kecamatan?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  status_aktif?: 'true' | 'false';

  @ApiPropertyOptional({ enum: StatusSarana })
  @IsOptional()
  @IsEnum(StatusSarana)
  status_sarana?: StatusSarana;

  @ApiPropertyOptional({
    description: 'Sumber identifier (mis. satset, yankes_klinik)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sumber_identifier?: string;

  @ApiPropertyOptional({ description: 'Kode sarana pada sumber identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  identifier_kode_sarana?: string;

  @ApiPropertyOptional({ description: 'Tanggal update awal (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal YYYY-MM-DD' })
  lower_bound_updated_at?: string;

  @ApiPropertyOptional({ description: 'Tanggal update akhir (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal YYYY-MM-DD' })
  upper_bound_updated_at?: string;
}

export interface SaranaWilayah {
  kode: string;
  nama: string;
  kode_bps?: string;
  kode_lama?: string;
}

export interface SaranaItem {
  kode_satusehat: string;
  kode_sarana: string;
  nama: string;
  telp?: string;
  email?: string;
  website?: string;
  longitude?: string;
  latitude?: string;
  operasional?: boolean;
  alamat?: string;
  provinsi?: SaranaWilayah;
  kabkota?: SaranaWilayah;
  kecamatan?: SaranaWilayah;
  kelurahan?: SaranaWilayah;
  jenis_sarana?: { kode: string; nama: string; nama_alt?: string };
  subjenis?: { kode: string; nama: string };
  kelas_sarana?: { kode: string; nama: string };
  status_sarana?: string;
  status_aktif?: boolean;
}

/** Respons mentah dari endpoint MSI SATUSEHAT. */
export interface MsiRawResponse {
  status_code: number;
  message: string;
  page?: number;
  total_page?: number;
  data: SaranaItem[] | null;
}

export interface SaranaListResponse {
  page: number;
  totalPage: number;
  items: SaranaItem[];
}

import { ApiPropertyOptional, ApiProperty, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  COMPOUND_TYPES,
  ROUTES,
  SIGNA_UNITS,
  SIGNA_WHEN,
  STRENGTH_UNITS,
} from '../entities/prescription-item.entity';
import type {
  CompoundType,
  RouteCode,
  SignaUnit,
  SignaWhen,
  StrengthUnit,
} from '../entities/prescription-item.entity';

export class CompoundIngredientDto {
  @ApiProperty({
    description: 'Kode KFA zat aktif (91…) atau produk (92…/93…)',
  })
  @Matches(/^9[123]\d{6}$/, {
    message: 'Kode KFA bahan racikan harus 8 digit (91/92/93…)',
  })
  kfaCode: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 125 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: STRENGTH_UNITS, example: 'mg' })
  @IsIn(STRENGTH_UNITS)
  amountUnit: StrengthUnit;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  perAmount: number;

  @ApiProperty({ enum: STRENGTH_UNITS, example: 'CAP' })
  @IsIn(STRENGTH_UNITS)
  perUnit: StrengthUnit;
}

export class SignaDto {
  @ApiPropertyOptional({ example: 'oral-3x1' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string | null;

  @ApiPropertyOptional({ example: 3, description: 'Kali per hari' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  timesPerDay?: number | null;

  @ApiPropertyOptional({ example: 1, description: 'Jumlah per kali pakai' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number | null;

  @ApiPropertyOptional({ enum: SIGNA_UNITS })
  @IsOptional()
  @IsIn(SIGNA_UNITS)
  unit?: SignaUnit | null;

  @ApiPropertyOptional({ enum: SIGNA_WHEN })
  @IsOptional()
  @IsIn(SIGNA_WHEN)
  when?: SignaWhen | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  prn?: boolean;

  @ApiPropertyOptional({ enum: ROUTES })
  @IsOptional()
  @IsIn(ROUTES)
  route?: RouteCode | null;

  @ApiProperty({ example: 'S 3 dd tab I p.c.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  latin: string;

  @ApiProperty({ example: '3 x sehari 1 tablet sesudah makan' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  text: string;
}

export class CreatePrescriptionItemDto {
  @ApiProperty({ description: 'Nama obat', example: 'Amoxicillin 500mg' })
  @IsNotEmpty()
  @IsString()
  drugName: string;

  @ApiPropertyOptional({
    description: 'Kode KFA produk obat (8 digit), dari pencarian KFA',
    example: '93002013',
  })
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Kode KFA harus 8 digit angka' })
  kfaCode?: string;

  @ApiPropertyOptional({ description: 'Nama produk menurut KFA' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  kfaName?: string;

  @ApiPropertyOptional({ description: 'Bentuk sediaan', example: 'Tablet' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dosageForm?: string;

  @ApiPropertyOptional({ description: 'Numero (jumlah)', example: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  numero?: number;

  @ApiPropertyOptional({ type: SignaDto, description: 'Aturan pakai' })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignaDto)
  signa?: SignaDto;

  @ApiPropertyOptional({ description: 'Dosis', example: '500 mg' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: 'Frekuensi', example: '3x sehari' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({ description: 'Durasi', example: '5 hari' })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ description: 'Jumlah', example: '15 tablet' })
  @IsOptional()
  @IsString()
  quantity?: string;

  @ApiPropertyOptional({
    description: 'Aturan pakai',
    example: 'Sesudah makan',
  })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    enum: COMPOUND_TYPES,
    description: 'Isi untuk obat racikan',
  })
  @IsOptional()
  @IsIn(COMPOUND_TYPES)
  compoundType?: CompoundType;

  @ApiPropertyOptional({ description: 'Bentuk sediaan racikan (mis. BS047)' })
  @ValidateIf((o: CreatePrescriptionItemDto) => !!o.compoundType)
  @Matches(/^BS\d{3}$/, { message: 'Bentuk sediaan racikan wajib diisi' })
  compoundFormCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  compoundFormName?: string;

  @ApiPropertyOptional({
    enum: STRENGTH_UNITS,
    description: 'Satuan hasil racikan (CAP, POWD, …)',
  })
  @ValidateIf((o: CreatePrescriptionItemDto) => !!o.compoundType)
  @IsIn(STRENGTH_UNITS)
  compoundUnit?: StrengthUnit;

  @ApiPropertyOptional({ type: [CompoundIngredientDto] })
  @ValidateIf((o: CreatePrescriptionItemDto) => !!o.compoundType)
  @IsArray()
  @ArrayMinSize(1, { message: 'Racikan minimal berisi 1 bahan' })
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => CompoundIngredientDto)
  ingredients?: CompoundIngredientDto[];

  @ApiPropertyOptional({ enum: ROUTES, description: 'Rute pemberian WHO ATC' })
  @ValidateIf(
    (o: CreatePrescriptionItemDto) =>
      !!o.compoundType || o.routeCode !== undefined,
  )
  @IsIn(ROUTES)
  routeCode?: RouteCode;
}

/**
 * Perbaiki pengodean obat yang sudah diresepkan: pilih produk KFA, atau
 * jadikan racikan dengan bahan berkode KFA (supaya bisa dikirim ke SATUSEHAT).
 */
export class SetPrescriptionCodingDto extends PickType(
  CreatePrescriptionItemDto,
  [
    'kfaCode',
    'kfaName',
    'compoundType',
    'compoundFormCode',
    'compoundFormName',
    'compoundUnit',
    'ingredients',
    'routeCode',
  ] as const,
) {}

export class DispensePrescriptionDto {
  @ApiPropertyOptional({ description: 'Nomor batch obat yang diserahkan' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  batchNumber?: string;

  @ApiPropertyOptional({ description: 'Tanggal kedaluwarsa (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  batchExpiry?: string;

  @ApiPropertyOptional({ description: 'Waktu penyerahan (default sekarang)' })
  @IsOptional()
  @IsDateString()
  dispensedAt?: string;
}

export class AdministerPrescriptionDto {
  @ApiPropertyOptional({
    description: 'Dosis yang diberikan, mis. 1 ampul / 10 unit',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dose?: string;

  @ApiPropertyOptional({ description: 'Waktu pemberian (default sekarang)' })
  @IsOptional()
  @IsDateString()
  administeredAt?: string;
}

export class SavePrescriptionReviewDto {
  @ApiProperty({
    description:
      '1.1–3.1: "sesuai" | "tidak_sesuai"; 3.2–3.5: true/false (ada masalah)',
    example: { '1.1': 'sesuai', '3.2': false },
  })
  @IsObject()
  answers: Record<string, 'sesuai' | 'tidak_sesuai' | boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class SavePrescriptionSignatureDto {
  @ApiProperty({ description: 'Tanda tangan dokter (data URL PNG)' })
  @Matches(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, {
    message: 'Tanda tangan harus berupa gambar PNG/JPEG',
  })
  @MaxLength(2_000_000)
  signature: string;
}

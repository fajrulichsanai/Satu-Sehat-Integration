import {
  IsArray,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DiscountType } from '../../billing-item/entities/billing-item.entity';
import { BillingStatus } from '../entities/billing.entity';
import { PaymentMethod } from '../../payments/entities/payment.entity';

export class BillingItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  tarifId?: number | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string | undefined;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number | undefined;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ enum: DiscountType, default: DiscountType.NOMINAL })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;
}

export class CreateBillingDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  encounterId: number | undefined;

  @ApiProperty({ type: [BillingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingItemDto)
  items: BillingItemDto[] | undefined;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDiscount?: number;

  @ApiPropertyOptional({ enum: DiscountType })
  @IsOptional()
  @IsEnum(DiscountType)
  totalDiscountType?: DiscountType;

  @ApiPropertyOptional({ default: 0, description: 'Biaya tambahan (nominal)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBillingDto {
  @ApiPropertyOptional({ type: [BillingItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingItemDto)
  items?: BillingItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDiscount?: number;

  @ApiPropertyOptional({ enum: DiscountType })
  @IsOptional()
  @IsEnum(DiscountType)
  totalDiscountType?: DiscountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Konfirmasi: bila total baru lebih kecil dari yang sudah dibayar, kembalikan selisihnya ke pasien (mengurangi pembayaran terbaru).',
  })
  @IsOptional()
  @IsBoolean()
  refundExcess?: boolean;
}

export class BillingQueryDto {
  @ApiPropertyOptional({
    description:
      'Bulan (YYYY-MM) berdasarkan tanggal invoice dibuat. Respons memuat `days` (tanggal berisi transaksi) saat diisi.',
    example: '2026-10',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month harus berformat YYYY-MM, mis. 2026-10',
  })
  month?: string;

  @ApiPropertyOptional({ enum: BillingStatus })
  @IsOptional()
  @IsEnum(BillingStatus)
  status?: BillingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

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
  @Max(1000)
  limit?: number = 20;
}

export class CreatePaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod | undefined;

  @ApiProperty({
    description:
      'Jumlah dibayar (DP, cicilan, atau pelunasan), ≤ sisa tagihan. Rp 0 hanya untuk tagihan yang sisanya Rp 0.',
  })
  @IsNumber()
  @Min(0)
  amount: number | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePaymentDto {
  @ApiPropertyOptional({
    description:
      'Jumlah dibayar yang benar — perbaikan salah input, bukan pembayaran baru',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

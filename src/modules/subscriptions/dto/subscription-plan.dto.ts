import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  SubscriptionBillingCycle,
  SubscriptionPlanTier,
} from '../entities/subscription-plan.entity';

export class CreateSubscriptionPlanDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: SubscriptionPlanTier })
  @IsOptional()
  @IsEnum(SubscriptionPlanTier)
  tier?: SubscriptionPlanTier;

  @ApiPropertyOptional({ enum: SubscriptionBillingCycle })
  @IsOptional()
  @IsEnum(SubscriptionBillingCycle)
  billingCycle?: SubscriptionBillingCycle;

  @ApiPropertyOptional({
    description: 'Flat one-time addition, e.g. Multi Klinik owner admin fee',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ownerFee?: number;

  @ApiPropertyOptional({
    description:
      'Jatah storage file layanan (GB, boleh desimal: 0.1 = 100 MB). Kosong = bawaan tier (masa coba 0,1, Starter 1, Pro 5, Multi Klinik 5 per cabang)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storageGb?: number;

  @ApiPropertyOptional({
    description:
      'Harga promo per bulan; `price` adalah harga normal (harga asli). Null = tanpa promo',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  promoPrice?: number | null;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Promo berlaku sampai tanggal ini (inklusif)',
  })
  @IsOptional()
  @IsDateString()
  promoUntil?: string | null;

  @ApiPropertyOptional({
    description:
      'Biaya admin owner Multi Klinik selama promo. Null = ownerFee biasa',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  promoOwnerFee?: number | null;

  @ApiPropertyOptional({
    description:
      'Batas akun aktif per klinik. Kosong = bawaan tier (masa coba & Starter 5, Pro 25, Multi Klinik 25 per cabang)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;
}

export class UpdateSubscriptionPlanDto extends PartialType(
  CreateSubscriptionPlanDto,
) {}

export class DurationDiscountsDto {
  @ApiPropertyOptional({ description: 'Diskon 3 bulan (%)', example: 5 })
  @IsNumber()
  @Min(0)
  @Max(50)
  3: number;

  @ApiPropertyOptional({ description: 'Diskon 6 bulan (%)', example: 10 })
  @IsNumber()
  @Min(0)
  @Max(50)
  6: number;

  @ApiPropertyOptional({ description: 'Diskon 12 bulan (%)', example: 17 })
  @IsNumber()
  @Min(0)
  @Max(50)
  12: number;
}

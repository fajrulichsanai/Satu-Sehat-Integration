import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
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
      'Jatah storage file layanan (GB). Kosong = bawaan tier (Starter 1, Pro 5, Multi Klinik 5 per cabang)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  storageGb?: number;

  @ApiPropertyOptional({
    description:
      'Batas akun aktif per klinik. Kosong = bawaan tier (Starter 5, Pro 25, Multi Klinik 25 per cabang)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;
}

export class UpdateSubscriptionPlanDto extends PartialType(
  CreateSubscriptionPlanDto,
) {}

import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BillingQueryDto {
  @ApiPropertyOptional({ enum: BillingStatus })
  @IsOptional()
  @IsEnum(BillingStatus)
  status?: BillingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class CreatePaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod | undefined;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateRefundRequestDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number | undefined;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string | undefined;
}

export class ApproveRefundDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsEnum(['approved', 'rejected'])
  action: 'approved' | 'rejected' | undefined;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalNote?: string;
}

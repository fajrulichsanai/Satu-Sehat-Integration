import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { SubscriptionPaymentStatus } from '../entities/subscription-payment.entity';

export class CreateSubscriptionPaymentDto {
  @Type(() => Number)
  @IsInt()
  planId: number;

  // Jumlah klinik yang dicover pembayaran ini — hanya relevan untuk paket
  // Multi Klinik (defaultnya 1, dan dipaksa jadi 1 untuk paket lain di
  // service). Amount dihitung di server dari plan.price * quantity +
  // plan.ownerFee, tidak dipercayakan ke client.
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewSubscriptionPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubscriptionPaymentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SubscriptionPaymentStatus })
  @IsOptional()
  @IsEnum(SubscriptionPaymentStatus)
  status?: SubscriptionPaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number;
}

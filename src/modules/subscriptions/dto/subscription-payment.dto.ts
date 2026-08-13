import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { SubscriptionPaymentStatus } from '../entities/subscription-payment.entity';

export class CreateSubscriptionPaymentDto {
  @Type(() => Number)
  @IsInt()
  planId: number;

  @IsNumber()
  @Min(0)
  amount: number;

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

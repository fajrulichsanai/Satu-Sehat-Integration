import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ClinicSubscriptionStatus } from '../entities/clinic-subscription.entity';

export class ClinicSubscriptionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ClinicSubscriptionStatus })
  @IsOptional()
  @IsEnum(ClinicSubscriptionStatus)
  status?: ClinicSubscriptionStatus;

  @ApiPropertyOptional({ description: 'Matches clinic name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ManualExtendDto {
  @Type(() => Number)
  @IsInt()
  clinicId: number;

  @Type(() => Number)
  @IsInt()
  planId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

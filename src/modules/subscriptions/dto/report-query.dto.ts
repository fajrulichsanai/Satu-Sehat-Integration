import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SuperAdminReportQueryDto {
  @ApiPropertyOptional({ description: 'ISO date, inclusive lower bound' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date, inclusive upper bound' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AuditActionType } from '../entities/audit-log.entity';

export class AuditLogQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'ISO date, inclusive lower bound on createdAt',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'ISO date, inclusive upper bound on createdAt',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actorId?: number;

  @ApiPropertyOptional({ enum: AuditActionType })
  @IsOptional()
  @IsEnum(AuditActionType)
  actionType?: AuditActionType;

  @ApiPropertyOptional({ description: 'e.g. Patient, MedicalRecord, Invoice' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Matches actor name or entity label' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Narrow to one clinic. Only takes effect for SUPER_ADMIN callers (who otherwise see every clinic).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number;
}

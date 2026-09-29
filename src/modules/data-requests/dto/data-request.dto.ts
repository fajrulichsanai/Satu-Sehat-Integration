import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  DataRequestStatus,
  DataRequestType,
} from '../entities/data-request.entity';

export class CreateDataRequestDto {
  @ApiProperty({ enum: DataRequestType })
  @IsEnum(DataRequestType)
  type: DataRequestType;

  @ApiPropertyOptional({
    description: 'Alasan atau catatan untuk tim ApexRecord',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class DataRequestQueryDto {
  @ApiPropertyOptional({ enum: DataRequestStatus })
  @IsOptional()
  @IsEnum(DataRequestStatus)
  status?: DataRequestStatus;
}

export class UpdateDataRequestDto {
  @ApiProperty({
    enum: [
      DataRequestStatus.IN_PROGRESS,
      DataRequestStatus.COMPLETED,
      DataRequestStatus.REJECTED,
    ],
  })
  @IsIn([
    DataRequestStatus.IN_PROGRESS,
    DataRequestStatus.COMPLETED,
    DataRequestStatus.REJECTED,
  ])
  status: DataRequestStatus;

  @ApiPropertyOptional({
    description: 'Catatan untuk klinik (wajib saat menolak)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

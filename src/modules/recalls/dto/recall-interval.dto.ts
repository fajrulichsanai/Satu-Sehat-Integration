import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpsertRecallIntervalDto {
  @ApiProperty({ description: 'Interval recall dalam hari', example: 180 })
  @IsInt()
  @Min(1)
  intervalDays: number;
}

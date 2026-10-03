import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTindakanBomDto {
  @ApiProperty()
  @IsInt()
  tarifId: number;

  @ApiProperty()
  @IsInt()
  barangId: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  qtyPakai: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  wajib?: boolean;
}

export class UpdateTindakanBomDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  qtyPakai?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  wajib?: boolean;
}

export class TindakanBomQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  tarifId: number;
}

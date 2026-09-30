import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { StokTransaksiType } from '../entities/stok-transaksi.entity';

export class CreateStokTransaksiDto {
  @ApiProperty()
  @IsInt()
  barangId: number;

  @ApiProperty({ enum: StokTransaksiType })
  @IsEnum(StokTransaksiType)
  type: StokTransaksiType;

  @ApiProperty()
  @IsInt()
  qty: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  hargaBeli?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noFaktur?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noBatch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  tanggalExpiry?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (o) =>
      o.type === StokTransaksiType.OUT ||
      o.type === StokTransaksiType.ADJUSTMENT ||
      o.type === StokTransaksiType.EXPIRED,
  )
  @IsString()
  @IsNotEmpty({ message: 'Alasan wajib diisi untuk tipe transaksi ini' })
  alasan?: string;

  @ApiProperty()
  @IsDateString()
  tanggal: string;
}

export class StokTransaksiQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  barangId?: number;

  @ApiPropertyOptional({ enum: StokTransaksiType })
  @IsOptional()
  @IsEnum(StokTransaksiType)
  type?: StokTransaksiType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 50;
}

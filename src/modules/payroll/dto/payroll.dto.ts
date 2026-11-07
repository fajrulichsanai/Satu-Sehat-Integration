import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class UpsertSalaryDto {
  @ApiPropertyOptional({ description: 'Gaji pokok bulanan (Rp)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  baseSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[0-9 -]*$/, { message: 'Nomor rekening hanya angka' })
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankHolder?: string;
}

export class UpdatePayrollItemDto {
  @ApiPropertyOptional({ description: 'Bonus (Rp), ditentukan owner' })
  @IsOptional()
  @IsInt()
  @Min(0)
  bonus?: number;

  @ApiPropertyOptional({ description: 'Potongan (Rp), mis. kasbon' })
  @IsOptional()
  @IsInt()
  @Min(0)
  deduction?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class PayPayrollDto {
  @ApiPropertyOptional({ description: 'Tanggal transfer (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  tanggal?: string;
}

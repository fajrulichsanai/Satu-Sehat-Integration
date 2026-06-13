import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MaxLength } from 'class-validator';

export class CreateOwnerCodeDto {
  @ApiProperty({ example: 'ABC123XYZ', description: 'Owner code' })
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}

export class OwnerCodeResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'ABC123XYZ' })
  code: string;

  @ApiProperty({ example: false })
  isUsed: boolean;

  @ApiProperty({ example: null })
  usedBy: number | null;

  @ApiProperty({ example: null })
  usedAt: Date | null;

  @ApiProperty({ example: '2026-06-13T10:00:00Z' })
  createdAt: Date;
}

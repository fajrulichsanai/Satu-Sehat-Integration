import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsString,
} from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'Ruang Perawatan 1' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'treatment_room',
    description:
      'Type of location (treatment_room, consultation_room, waiting_room, etc.)',
  })
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiProperty({ example: 'Ruangan perawatan gigi lantai 1', required: false })
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ example: true, default: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: 'LOC123456',
    description: 'SATUSEHAT Location ID',
    required: false,
  })
  @IsOptional()
  @MaxLength(100)
  satusehatLocationId?: string;
}

export class UpdateLocationDto {
  @ApiProperty({ example: 'Ruang Perawatan 1', required: false })
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'treatment_room', required: false })
  @IsOptional()
  @MaxLength(50)
  type?: string;

  @ApiProperty({ example: 'Ruangan perawatan gigi lantai 1', required: false })
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 'LOC123456', required: false })
  @IsOptional()
  @MaxLength(100)
  satusehatLocationId?: string;
}

export class LocationResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Ruang Perawatan 1' })
  name: string;

  @ApiProperty({ example: 'treatment_room' })
  type: string;

  @ApiProperty({ example: 'Ruangan perawatan gigi lantai 1' })
  description: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 'LOC123456' })
  satusehatLocationId: string;

  @ApiProperty({ example: 1 })
  clinicId: number;

  @ApiProperty({ example: '2026-06-11T12:00:00Z' })
  createdAt: Date;
}

export class LocationListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [LocationResponseDto] })
  data: LocationResponseDto[];
}

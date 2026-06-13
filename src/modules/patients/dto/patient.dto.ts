import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Gender, MaritalStatus, SyncStatus } from '../../../enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { IsValidNIK } from '../../../common/validators/nik.validator';

export class CreatePatientDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string | undefined;

  @ApiPropertyOptional({
    example: '3171234567890001',
    description: 'Required unless isNewborn',
  })
  @IsOptional()
  @IsValidNIK()
  nik?: string;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  @IsNotEmpty()
  gender: Gender | undefined;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 1, Jakarta' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Jakarta' })
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'DKI Jakarta' })
  @IsOptional()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({ example: '08123456789' })
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'budi@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: MaritalStatus })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({
    example: false,
    description: 'Set true for newborn without NIK',
  })
  @IsOptional()
  isNewborn?: boolean;

  @ApiPropertyOptional({
    example: 'Siti Rahayu',
    description: 'NIK Ibu (for newborn)',
  })
  @IsOptional()
  @IsValidNIK()
  nikIbu?: string;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}

export class PatientQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name, NIK, or No. RM' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}

export class PatientResponseDto {
  @ApiProperty() id: number | undefined;
  @ApiProperty() noRm: string | undefined;
  @ApiProperty() clinicId: number | undefined;
  @ApiPropertyOptional() nik?: string;
  @ApiProperty() name: string | undefined;
  @ApiPropertyOptional() dateOfBirth?: Date;
  @ApiProperty({ enum: Gender }) gender: Gender | undefined;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() address?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional() province?: string;
  @ApiPropertyOptional({ enum: MaritalStatus }) maritalStatus?: MaritalStatus;
  @ApiPropertyOptional() satusehatPatientId?: string;
  @ApiProperty({ enum: SyncStatus }) syncStatus: SyncStatus | undefined;
  @ApiProperty() createdAt: Date | undefined;
  @ApiProperty() updatedAt: Date | undefined;
}

import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { UserRole } from '../../../enums';

export class CreateUserDto {
  @ApiProperty({ example: 'dokter@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Dr. Jane Smith' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'dokter', enum: UserRole })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  practitionerId?: number;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'dokter@clinic.com' })
  email: string;

  @ApiProperty({ example: 'Dr. Jane Smith' })
  name: string;

  @ApiProperty({ example: 'dokter' })
  role: string;

  @ApiProperty({ example: 1 })
  clinicId: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-06-11T12:00:00Z', required: false })
  emailVerifiedAt?: Date;

  @ApiProperty({ example: '2026-06-11T12:00:00Z', required: false })
  lastLoginAt?: Date;

  @ApiProperty({ example: '2026-06-11T12:00:00Z' })
  createdAt: Date;
}

export class UserListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({
    example: { total: 10, page: 1, limit: 20 },
    required: false,
  })
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

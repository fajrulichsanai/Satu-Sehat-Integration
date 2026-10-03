import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsEnum,
  IsOptional,
  IsInt,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../../enums/user-role.enum';

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

export class InviteUserDto {
  @ApiProperty({ example: 'dokter@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Dr. Jane Smith' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'dokter',
    enum: UserRole,
    description: 'Role yang akan diberikan ke user baru',
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Wajib diisi oleh Super Admin untuk menentukan klinik tujuan',
  })
  @IsOptional()
  @IsInt()
  clinicId?: number;
}

export class UpdateUserDto {
  @ApiProperty({ example: 'Dr. Jane Smith', required: false })
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'dokter@clinic.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ example: 'admin', enum: UserRole })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}

export class AssignUserRoleDto {
  @ApiProperty({
    example: 'dokter',
    enum: [UserRole.OWNER, UserRole.ADMIN, UserRole.DOKTER],
    description: 'Role yang akan di-assign (tidak bisa pending)',
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}

export class RoleItemDto {
  @ApiProperty({ example: 'admin' })
  value: string;

  @ApiProperty({ example: 'Admin' })
  label: string;
}

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

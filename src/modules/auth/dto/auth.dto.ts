import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { UserRole } from '../../../enums';

export class RegisterDto {
  @ApiProperty({ example: 'admin@clinic.com', description: 'Email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string | undefined;

  @ApiProperty({ example: 'SecurePass123!', description: 'Password (min 8 characters)' })
  @IsNotEmpty()
  @MinLength(8)
  password: string | undefined;

  @ApiProperty({ example: 'Dr. John Doe', description: 'Full name' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string | undefined;

  @ApiProperty({
    example: 'owner',
    enum: UserRole,
    description: 'User role',
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole | undefined;

  @ApiProperty({
    example: 'ABC123',
    description: 'Owner code (required for owner role)',
    required: false,
  })
  @IsOptional()
  @MaxLength(20)
  ownerCode?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string | undefined;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsNotEmpty()
  password: string | undefined;
}

export class LoginResponseDto {
  @ApiProperty({ example: true })
  success: boolean | undefined;

  @ApiProperty({
    example: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      user: {
        id: 1,
        email: 'admin@clinic.com',
        name: 'Dr. John Doe',
        role: 'owner',
        clinicId: 1,
      },
    },
  })
  data: {
    accessToken: string | undefined;
    user: {
      id: number | undefined;
      email: string | undefined;
      name: string | undefined;
      role: string | undefined;
      clinicId: number | undefined;
      practitionerId?: number | undefined;
    };
  } | undefined;
}

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number | undefined;

  @ApiProperty({ example: 'admin@clinic.com' })
  email: string | undefined;

  @ApiProperty({ example: 'Dr. John Doe' })
  name: string | undefined;

  @ApiProperty({ example: 'owner' })
  role: string | undefined;

  @ApiProperty({ example: 1 })
  clinicId: number | undefined;

  @ApiProperty({ example: 1, required: false })
  practitionerId?: number | undefined;

  @ApiProperty({ example: true })
  isActive: boolean | undefined;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsNotEmpty()
  refreshToken: string | undefined;
}

export class ActivationStatusResponseDto {
  @ApiProperty({ example: true })
  isActive: boolean | undefined;

  @ApiProperty({ example: 'owner' })
  role: string | undefined ;

  @ApiProperty({ example: 1, nullable: true })
  clinicId: number | undefined;
}

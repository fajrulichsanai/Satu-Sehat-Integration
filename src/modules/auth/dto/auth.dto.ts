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
  email: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Password (min 8 characters)' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Dr. John Doe', description: 'Full name' })
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'owner',
    enum: UserRole,
    description: 'User role',
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

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
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsNotEmpty()
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

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
    accessToken: string;
    user: {
      id: number;
      email: string;
      name: string;
      role: string;
      clinicId: number;
      practitionerId?: number;
    };
  };
}

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'admin@clinic.com' })
  email: string;

  @ApiProperty({ example: 'Dr. John Doe' })
  name: string;

  @ApiProperty({ example: 'owner' })
  role: string;

  @ApiProperty({ example: 1 })
  clinicId: number;

  @ApiProperty({ example: 1, required: false })
  practitionerId?: number;

  @ApiProperty({ example: true })
  isActive: boolean;
}

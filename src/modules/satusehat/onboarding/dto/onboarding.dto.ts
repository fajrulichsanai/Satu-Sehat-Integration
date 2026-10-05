import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CONTACT_PURPOSES,
  DAYS_OF_WEEK,
  FACILITY_TYPES,
  ORGANIZATION_TYPES,
  PHYSICAL_TYPES,
} from '../address';

export class AddressDto {
  @ApiPropertyOptional({ description: 'Nama jalan, blok, nomor' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  line?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{2}$/)
  provinceCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provinceName?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}$/) cityCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cityName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{6,7}$/)
  districtCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  districtName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{8,10}$/)
  villageCode?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  villageName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,3}$/, { message: 'RT berupa angka' })
  rt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,3}$/, { message: 'RW berupa angka' })
  rw?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{5}$/, { message: 'Kode pos 5 digit' })
  postalCode?: string;
}

export class FacilityProfileDto extends AddressDto {
  @ApiProperty({ enum: FACILITY_TYPES })
  @IsIn(FACILITY_TYPES)
  facilityType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  website?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}

export class SaveOrganizationDto {
  @ApiPropertyOptional({
    description: 'Induk (id lokal); kosong = organisasi induk fasyankes',
  })
  @IsOptional()
  @IsInt()
  parentId?: number | null;

  @ApiProperty({ description: 'Kode/nomor internal' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: Object.keys(ORGANIZATION_TYPES) })
  @IsIn(Object.keys(ORGANIZATION_TYPES))
  type: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  website?: string;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @ApiPropertyOptional({ enum: Object.keys(CONTACT_PURPOSES) })
  @IsOptional()
  @IsIn(Object.keys(CONTACT_PURPOSES))
  contactPurpose?: string;
}

export class HoursDto {
  @ApiProperty({ type: [String], enum: DAYS_OF_WEEK })
  @IsArray()
  @IsIn(DAYS_OF_WEEK, { each: true })
  days: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() allDay?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  opening?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  closing?: string;
}

export class SaveLocationDto {
  @ApiProperty() @IsNotEmpty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) code?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ enum: Object.keys(PHYSICAL_TYPES) })
  @IsIn(Object.keys(PHYSICAL_TYPES))
  physicalType: string;

  @ApiPropertyOptional({ description: 'Lokasi induk (id lokal)' })
  @IsOptional()
  @IsInt()
  parentLocationId?: number | null;

  @ApiPropertyOptional({
    description: 'Organisasi pengelola (id lokal); kosong = organisasi induk',
  })
  @IsOptional()
  @IsInt()
  organizationId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number | null;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number | null;

  @ApiPropertyOptional({ type: HoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HoursDto)
  hours?: HoursDto | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

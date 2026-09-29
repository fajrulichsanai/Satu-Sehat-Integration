import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import {
  ConsentSignerRelation,
  PatientConsentStatus,
} from '../entities/patient-consent.entity';

export class CreatePatientConsentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  patientId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  encounterId?: number;

  @ApiPropertyOptional({ description: 'Tindakan yang dimintakan persetujuan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tarifId?: number;

  @ApiPropertyOptional({
    description:
      'Template yang dipakai sebagai isi awal. Jika kosong dan tarifId diisi, sistem mencari template klinik untuk tarif tsb.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  templateId?: number;
}

export class PatientConsentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  encounterId?: number;

  @ApiPropertyOptional({ enum: PatientConsentStatus })
  @IsOptional()
  @IsEnum(PatientConsentStatus)
  status?: PatientConsentStatus;

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
  limit?: number = 20;
}

export enum ConsentSignerRole {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
}

export class SignPatientConsentDto {
  @ApiProperty({ enum: ConsentSignerRole })
  @IsEnum(ConsentSignerRole)
  role: ConsentSignerRole;

  @ApiProperty({
    description: 'Data URL PNG tanda tangan (dari signature pad)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\//, {
    message: 'signatureDataUrl harus berupa data URL gambar',
  })
  signatureDataUrl: string;

  @ApiPropertyOptional({
    description: 'Nama penanda tangan (mis. wali pasien), default nama pasien',
  })
  @IsOptional()
  @IsString()
  signerName?: string;

  @ApiPropertyOptional({
    enum: ConsentSignerRelation,
    description:
      'Hubungan penanda tangan dengan pasien (hanya untuk role patient)',
  })
  @IsOptional()
  @IsEnum(ConsentSignerRelation)
  signerRelation?: ConsentSignerRelation;

  @ApiPropertyOptional({
    description: 'Alamat penanda tangan (hanya untuk role patient)',
  })
  @IsOptional()
  @IsString()
  signerAddress?: string;

  @ApiPropertyOptional({
    description: 'No. telp penanda tangan (hanya untuk role patient)',
  })
  @IsOptional()
  @IsString()
  signerPhone?: string;
}

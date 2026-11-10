import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateDiagnosisDto {
  @IsIn(['icd10', 'snomed'])
  system: 'icd10' | 'snomed';

  @IsString()
  @MaxLength(20)
  code: string;

  @IsString()
  @MaxLength(255)
  display: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameId?: string | null;

  @IsBoolean()
  primary: boolean;
}

export class CreateSoapTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatment?: string;

  @ApiPropertyOptional({ type: [TemplateDiagnosisDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TemplateDiagnosisDto)
  diagnoses?: TemplateDiagnosisDto[];

  @ApiPropertyOptional({
    default: false,
    description: 'Only owner can set isShared=true',
  })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}

export class UpdateSoapTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatment?: string;

  @ApiPropertyOptional({ type: [TemplateDiagnosisDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TemplateDiagnosisDto)
  diagnoses?: TemplateDiagnosisDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}

export class SoapTemplateQueryDto {
  @ApiPropertyOptional({ enum: ['personal', 'shared', 'all'], default: 'all' })
  @IsOptional()
  @IsString()
  type?: 'personal' | 'shared' | 'all' = 'all';
}

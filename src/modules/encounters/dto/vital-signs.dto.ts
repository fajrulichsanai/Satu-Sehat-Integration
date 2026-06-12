import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertVitalSignsDto {
  @ApiPropertyOptional({ description: 'Tekanan darah sistolik (mmHg)', minimum: 60, maximum: 250 })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(250)
  sistolic?: number;

  @ApiPropertyOptional({ description: 'Tekanan darah diastolik (mmHg)', minimum: 40, maximum: 150 })
  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(150)
  diastolic?: number;

  @ApiPropertyOptional({ description: 'Denyut jantung (/menit)', minimum: 30, maximum: 250 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(250)
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Frekuensi napas (/menit)', minimum: 10, maximum: 60 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(60)
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'Suhu tubuh (°C)', minimum: 34.0, maximum: 42.0 })
  @IsOptional()
  @IsNumber()
  @Min(34.0)
  @Max(42.0)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Berat badan (kg)', minimum: 0.5, maximum: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(500)
  weight?: number;

  @ApiPropertyOptional({ description: 'Tinggi badan (cm)', minimum: 30, maximum: 250 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(250)
  height?: number;

  @ApiPropertyOptional({ description: 'SpO2 (%)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  spo2?: number;
}

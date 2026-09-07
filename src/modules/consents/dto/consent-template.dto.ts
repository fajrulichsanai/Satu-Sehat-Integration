import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpsertConsentTemplateDto {
  @ApiProperty({
    description: 'Judul formulir persetujuan',
    example: 'Persetujuan Tindakan Scaling',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Isi teks persetujuan (informed consent)' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

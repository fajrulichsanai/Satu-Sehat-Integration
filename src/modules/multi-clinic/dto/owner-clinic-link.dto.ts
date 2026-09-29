import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class LinkClinicDto {
  @ApiProperty({ description: 'ID klinik yang ditambahkan ke owner ini' })
  @IsInt()
  clinicId: number;
}

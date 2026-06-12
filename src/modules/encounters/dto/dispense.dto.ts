import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DispenseItemDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  prescriptionId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  medicationId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityDispensed: number;
}

export class DispenseMedicationsDto {
  @ApiProperty({ type: [DispenseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispenseItemDto)
  items: DispenseItemDto[];
}

import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OhisScoreItemDto {
  debris: 0 | 1 | 2 | 3;
  calculus: 0 | 1 | 2 | 3;
}

export class UpsertOhisDto {
  @ApiProperty({
    description: 'Scores for 6 index teeth: 16, 11, 26, 46, 31, 36',
    example: {
      '16': { debris: 1, calculus: 0 },
      '11': { debris: 2, calculus: 1 },
      '26': { debris: 1, calculus: 0 },
      '46': { debris: 2, calculus: 2 },
      '31': { debris: 1, calculus: 0 },
      '36': { debris: 2, calculus: 1 },
    },
  })
  @IsObject()
  scores: Record<string, OhisScoreItemDto>;
}

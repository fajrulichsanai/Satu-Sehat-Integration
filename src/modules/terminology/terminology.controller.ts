import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TerminologyService } from './terminology.service';
import type { TerminologySystem } from './entities/terminology-concept.entity';

@ApiTags('terminology')
@ApiBearerAuth('JWT-auth')
@Controller('terminology')
export class TerminologyController {
  constructor(private readonly terminologyService: TerminologyService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search ICD-10 / SNOMED CT by code, name or Indonesian name',
  })
  @ApiQuery({ name: 'system', enum: ['icd10', 'snomed'] })
  @ApiQuery({ name: 'q' })
  @ApiQuery({ name: 'limit', required: false })
  async search(
    @Query('system') system: TerminologySystem,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.terminologyService.search(
      system,
      q,
      limit ? parseInt(limit, 10) || 20 : 20,
    );
    return { success: true, data };
  }

  @Get(':system/:code')
  @ApiOperation({
    summary:
      'Explanation for one code: Indonesian name, classification, equivalent code',
  })
  async detail(
    @Param('system') system: TerminologySystem,
    @Param('code') code: string,
  ) {
    return {
      success: true,
      data: await this.terminologyService.detail(system, code),
    };
  }
}

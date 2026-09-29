import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { TerminologyService } from './terminology.service';
import type { TerminologySystem } from './entities/terminology-concept.entity';

/**
 * ICD-10 / SNOMED CT lookup. Public reference data (no patient data), so it
 * also works without login — the landing page lets visitors try it —
 * throttled per signed-in user, or per IP when anonymous.
 */
@ApiTags('terminology')
@ApiBearerAuth('JWT-auth')
@Public()
@Throttle({ default: { limit: 60, ttl: 60000 } })
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

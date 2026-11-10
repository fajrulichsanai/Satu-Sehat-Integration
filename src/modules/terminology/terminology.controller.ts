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
import { ClinicalCatalogService } from './clinical-catalog.service';
import type { TerminologySystem } from './entities/terminology-concept.entity';

import { parseLimit } from '../../common/utils/query.util';
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
  constructor(
    private readonly terminologyService: TerminologyService,
    private readonly catalog: ClinicalCatalogService,
  ) {}

  // ── Katalog pemeriksaan resmi SATUSEHAT (sebelum ':system/:code') ──

  @Get('lab-tests')
  @ApiOperation({ summary: 'Cari pemeriksaan laboratorium (LOINC SATUSEHAT)' })
  @ApiQuery({ name: 'q' })
  @ApiQuery({ name: 'use', enum: ['request', 'result'], required: false })
  searchLab(
    @Query('q') q: string,
    @Query('use') use?: 'request' | 'result',
    @Query('limit') limit?: string,
  ) {
    return {
      success: true,
      data: this.catalog.searchLab(
        q ?? '',
        use === 'request' || use === 'result' ? use : undefined,
        parseLimit(limit, 50) ?? 20,
      ),
    };
  }

  @Get('lab-tests/:code')
  @ApiOperation({
    summary: 'Detail pemeriksaan lab + pilihan jawaban + parameter hasilnya',
  })
  labDetail(@Param('code') code: string) {
    return {
      success: true,
      data: {
        ...this.catalog.getLab(code),
        // Pilihan jawaban per parameter (hasil ordinal/nominal)
        results: this.catalog
          .labResultsFor(code)
          .map((r) => this.catalog.getLab(r.code)),
      },
    };
  }

  @Get('radiology-tests')
  @ApiOperation({ summary: 'Cari pemeriksaan radiologi (LOINC SATUSEHAT)' })
  searchRadiology(
    @Query('q') q: string,
    @Query('dental') dental?: string,
    @Query('limit') limit?: string,
  ) {
    return {
      success: true,
      data: this.catalog.searchRadiology(
        q ?? '',
        {
          dental:
            dental === 'true' ? true : dental === 'false' ? false : undefined,
          use: 'request',
        },
        parseLimit(limit, 50) ?? 20,
      ),
    };
  }

  @Get('diet-types')
  @ApiOperation({ summary: 'Cari jenis diet (lampiran NutritionOrder)' })
  searchDiet(@Query('q') q: string, @Query('limit') limit?: string) {
    return {
      success: true,
      data: this.catalog.searchDiet(q ?? '', parseLimit(limit, 50) ?? 20),
    };
  }

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
      parseLimit(limit, 50) ?? 20,
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

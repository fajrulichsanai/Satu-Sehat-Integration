import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IcdService } from './icd.service';

@ApiTags('icd')
@ApiBearerAuth('JWT-auth')
@Controller()
export class IcdController {
  constructor(private readonly icdService: IcdService) {}

  @Get('icd10/search')
  @ApiOperation({ summary: 'Search ICD-10 codes' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  searchIcd10(@Query('q') q: string, @Query('limit') limit?: string) {
    const data = this.icdService.searchIcd10(q, limit ? parseInt(limit) : 25);
    return { success: true, data };
  }

  @Get('icd9/search')
  @ApiOperation({ summary: 'Search ICD-9-CM procedure codes' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  searchIcd9(@Query('q') q: string, @Query('limit') limit?: string) {
    const data = this.icdService.searchIcd9(q, limit ? parseInt(limit) : 25);
    return { success: true, data };
  }
}

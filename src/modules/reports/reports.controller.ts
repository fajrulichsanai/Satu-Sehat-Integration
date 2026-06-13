import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  FinancialReportQueryDto,
  RetrySyncDto,
  SatusehatSyncReportQueryDto,
  VisitReportQueryDto,
} from './dto/report.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums/user-role.enum';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('visits')
  @ApiOperation({ summary: 'Visit report (dokter sees own only)' })
  async getVisits(
    @ClinicId() clinicId: number,
    @Query() query: VisitReportQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getVisitReport(clinicId, query, user);
  }

  @Get('financial')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Financial report (owner only)' })
  async getFinancial(
    @ClinicId() clinicId: number,
    @Query() query: FinancialReportQueryDto,
  ) {
    return this.reportsService.getFinancialReport(clinicId, query);
  }

  @Get('satusehat-sync')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'SATUSEHAT sync status report (owner only)' })
  async getSatusehatSync(
    @ClinicId() clinicId: number,
    @Query() query: SatusehatSyncReportQueryDto,
  ) {
    return this.reportsService.getSatusehatSyncReport(clinicId, query);
  }

  @Post('satusehat-sync/retry')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Retry failed SATUSEHAT syncs' })
  async retrySync(@ClinicId() clinicId: number, @Body() dto: RetrySyncDto) {
    const data = await this.reportsService.retrySync(clinicId, dto);
    return { success: true, data };
  }
}

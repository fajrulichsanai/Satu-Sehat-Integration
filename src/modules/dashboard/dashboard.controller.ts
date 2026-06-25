import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';

@ApiTags('dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Ringkasan statistik dashboard klinik' })
  async getSummary(@ClinicId() clinicId: number) {
    const data = await this.dashboardService.getSummary(clinicId);
    return { success: true, data };
  }

  @Get('activity')
  @ApiOperation({ summary: 'Aktivitas terbaru klinik' })
  async getActivity(
    @ClinicId() clinicId: number,
    @Query('limit') limit?: string,
  ) {
    const data = await this.dashboardService.getRecentActivity(
      clinicId,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { success: true, data };
  }

  @Get('highlights')
  @ApiOperation({ summary: 'Ringkasan per modul untuk dashboard' })
  async getHighlights(@ClinicId() clinicId: number) {
    const data = await this.dashboardService.getModuleHighlights(clinicId);
    return { success: true, data };
  }
}

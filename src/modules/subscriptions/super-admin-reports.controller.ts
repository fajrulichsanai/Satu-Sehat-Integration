import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminReportsService } from './super-admin-reports.service';
import { SuperAdminReportQueryDto } from './dto/report-query.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../enums';
import { SkipSubscriptionCheck } from './guards/subscription.guard';

@ApiTags('super-admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@SkipSubscriptionCheck()
@Controller('super-admin/reports')
export class SuperAdminReportsController {
  constructor(private readonly reportsService: SuperAdminReportsService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'SaaS-level summary: clinic counts, MRR, revenue/new-clinics by month, plan mix',
  })
  summary(@Query() query: SuperAdminReportQueryDto) {
    return this.reportsService.summary(query);
  }
}

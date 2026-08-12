import { Controller, Get, Param, ParseIntPipe, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../enums';
import { AuditActionType } from './entities/audit-log.entity';

@ApiTags('audit-log')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries for the owner\'s clinic' })
  async findAll(@ClinicId() clinicId: number | null, @Query() query: AuditLogQueryDto) {
    const data = await this.auditLogService.findAll(clinicId, query);
    return { success: true, data };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export filtered audit log entries as CSV' })
  async export(
    @ClinicId() clinicId: number | null,
    @Query() query: AuditLogQueryDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.auditLogService.exportCsv(clinicId, query);
    await this.auditLogService.record({
      clinicId,
      actorId: req.user?.userId ?? null,
      actorName: req.user?.name ?? 'Unknown',
      actorRole: req.user?.role ?? 'unknown',
      actionType: AuditActionType.EXPORT,
      entityType: 'AuditLog',
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });

    const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single audit log entry detail (full before/after)' })
  async findOne(@Param('id', ParseIntPipe) id: number, @ClinicId() clinicId: number | null) {
    const entry = await this.auditLogService.findOne(id, clinicId);
    return { success: true, data: entry };
  }
}

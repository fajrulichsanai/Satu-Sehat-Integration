import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';
import { SkipSubscriptionCheck } from '../subscriptions/guards/subscription.guard';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditActionType,
  AuditStatus,
} from '../audit-log/entities/audit-log.entity';
import { DataRequestsService } from './data-requests.service';
import { DataRequestType } from './entities/data-request.entity';
import {
  CreateDataRequestDto,
  DataRequestQueryDto,
  UpdateDataRequestDto,
} from './dto/data-request.dto';

/**
 * Data-subject requests under UU PDP: a clinic owner asks for a copy of the
 * clinic's data or for the account to be closed. Allowed even after the
 * subscription lapses — an expired clinic still has these rights.
 */
@ApiTags('Data Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@SkipSubscriptionCheck()
@Controller()
export class DataRequestsController {
  constructor(
    private readonly service: DataRequestsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('data-requests')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Ajukan permintaan ekspor data atau penutupan akun klinik',
  })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateDataRequestDto,
    @Req() req: any,
  ) {
    const data = await this.service.create(user.clinicId, user.userId, dto);
    void this.auditLogService.record({
      clinicId: user.clinicId,
      actorId: user.userId,
      actorName: user.name ?? user.email,
      actorRole: user.role,
      actionType: AuditActionType.CREATE,
      entityType: 'DataRequest',
      entityId: data.id,
      entityLabel:
        dto.type === DataRequestType.EXPORT
          ? 'Permintaan ekspor data'
          : 'Permintaan tutup akun',
      status: AuditStatus.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return { success: true, data };
  }

  @Get('data-requests')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Riwayat permintaan data klinik ini' })
  async list(@CurrentUser() user: any) {
    return {
      success: true,
      data: await this.service.listForClinic(user.clinicId),
    };
  }

  @Get('super-admin/data-requests')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Semua permintaan data (super admin)' })
  async listAll(@Query() q: DataRequestQueryDto) {
    return { success: true, data: await this.service.listAll(q.status) };
  }

  @Patch('super-admin/data-requests/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Perbarui status permintaan data (super admin)' })
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDataRequestDto,
    @Req() req: any,
  ) {
    const data = await this.service.update(id, user.userId, dto);
    void this.auditLogService.record({
      clinicId: data.clinicId,
      actorId: user.userId,
      actorName: user.name ?? user.email,
      actorRole: user.role,
      actionType: AuditActionType.UPDATE,
      entityType: 'DataRequest',
      entityId: id,
      entityLabel: `Permintaan data → ${dto.status}`,
      status: AuditStatus.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return { success: true, data };
  }
}

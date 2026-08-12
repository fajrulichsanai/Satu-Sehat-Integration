import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OperationalRecordsService } from './operational-records.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import {
  CreateOperationalRecordDto,
  UpdateOperationalRecordDto,
  OperationalRecordListQueryDto,
} from './dto/operational-record.dto';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('operational-records')
@Controller('operational-records')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@ApiBearerAuth('JWT-auth')
export class OperationalRecordsController {
  constructor(private readonly service: OperationalRecordsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List operational records' })
  async findAll(
    @Query() query: OperationalRecordListQueryDto,
    @ClinicId() clinicId: number,
  ) {
    return this.service.list(clinicId, query);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get operational record by ID' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return this.service.findOne(id, clinicId);
  }

  @Post()
  @Audit('OperationalRecord', AuditActionType.CREATE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create operational record' })
  async create(
    @Body() dto: CreateOperationalRecordDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.service.create(dto, clinicId, user.userId);
  }

  @Put(':id')
  @Audit('OperationalRecord', AuditActionType.UPDATE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update operational record' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperationalRecordDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
    @Req() req: any,
  ) {
    req.auditBefore = await this.service.findOne(id, clinicId).catch(() => null);
    return this.service.update(id, dto, clinicId, user.userId);
  }

  @Delete(':id')
  @Audit('OperationalRecord', AuditActionType.DELETE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete operational record' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Req() req: any,
  ) {
    req.auditBefore = await this.service.findOne(id, clinicId).catch(() => null);
    return this.service.remove(id, clinicId);
  }
}

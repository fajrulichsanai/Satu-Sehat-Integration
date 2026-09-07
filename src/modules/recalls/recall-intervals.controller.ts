import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecallIntervalsService } from './recall-intervals.service';
import { UpsertRecallIntervalDto } from './dto/recall-interval.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('recalls')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('recall-intervals')
export class RecallIntervalsController {
  constructor(
    private readonly recallIntervalsService: RecallIntervalsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List konfigurasi interval recall per tarif' })
  async findAll(@ClinicId() clinicId: number) {
    const data = await this.recallIntervalsService.findAll(clinicId);
    return { success: true, data };
  }

  @Put(':tarifId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @Audit('RecallInterval', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Atur/ubah interval recall untuk sebuah tarif' })
  async upsert(
    @Param('tarifId', ParseIntPipe) tarifId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertRecallIntervalDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.recallIntervalsService.upsert(
      clinicId,
      tarifId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete(':tarifId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @Audit('RecallInterval', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Nonaktifkan recall otomatis untuk sebuah tarif' })
  async remove(
    @Param('tarifId', ParseIntPipe) tarifId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.recallIntervalsService.remove(clinicId, tarifId);
    return { success: true };
  }
}

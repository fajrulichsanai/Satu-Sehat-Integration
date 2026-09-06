import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionItemDto } from './dto/prescription-item.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('encounters/:encounterId/prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List prescription items for an encounter' })
  async findAll(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.prescriptionsService.listByEncounter(
      encounterId,
      clinicId,
    );
    return { success: true, data };
  }

  @Post()
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Add a prescription item to an encounter' })
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreatePrescriptionItemDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.create(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete(':itemId')
  @Audit('MedicalRecord', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Remove a prescription item from an encounter' })
  async remove(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.prescriptionsService.remove(encounterId, clinicId, itemId);
    return { success: true };
  }
}

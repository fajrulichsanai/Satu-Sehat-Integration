import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OdontogramService } from './odontogram.service';
import {
  UpsertToothConditionDto,
  CreateDentalBridgeDto,
} from './dto/odontogram.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('patients')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('patients/:patientId/odontogram')
export class OdontogramController {
  constructor(private readonly odontogramService: OdontogramService) {}

  @Get()
  @ApiOperation({ summary: "Get a patient's odontogram (teeth + bridges)" })
  async findOne(
    @Param('patientId', ParseIntPipe) patientId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.odontogramService.getOdontogram(
      patientId,
      clinicId,
    );
    return { success: true, data };
  }

  @Put('teeth/:toothNumber')
  @Audit('Odontogram', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Create or update a single tooth condition' })
  async upsertTooth(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('toothNumber', ParseIntPipe) toothNumber: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertToothConditionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.odontogramService.upsertTooth(
      patientId,
      clinicId,
      toothNumber,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Post('bridges')
  @Audit('Odontogram', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Add a fixed bridge spanning a tooth range' })
  async createBridge(
    @Param('patientId', ParseIntPipe) patientId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateDentalBridgeDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.odontogramService.createBridge(
      patientId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete('bridges/:bridgeId')
  @Audit('Odontogram', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Remove a bridge' })
  async removeBridge(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('bridgeId', ParseIntPipe) bridgeId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.odontogramService.removeBridge(patientId, clinicId, bridgeId);
    return { success: true };
  }
}

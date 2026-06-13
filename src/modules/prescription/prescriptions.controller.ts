import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/prescription.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List prescriptions for encounter' })
  async findAll(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.prescriptionsService.findAll(encounterId, clinicId);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Add prescription to encounter' })
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreatePrescriptionDto,
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

  @Delete(':prescriptionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel prescription (only if not dispensed)' })
  async remove(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('prescriptionId', ParseIntPipe) prescriptionId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.prescriptionsService.remove(
      encounterId,
      prescriptionId,
      clinicId,
    );
    return { success: true };
  }
}

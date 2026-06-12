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
import { DiagnosesService } from './diagnoses.service';
import { CreateDiagnosisDto } from './dto/diagnosis.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/diagnoses')
export class DiagnosesController {
  constructor(private readonly diagnosesService: DiagnosesService) {}

  @Get()
  @ApiOperation({ summary: 'List diagnoses for encounter' })
  async findAll(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.diagnosesService.findAll(encounterId, clinicId);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Add diagnosis to encounter' })
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateDiagnosisDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.diagnosesService.create(encounterId, clinicId, dto, user.userId);
    return { success: true, data };
  }

  @Delete(':diagnosisId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove diagnosis from encounter' })
  async remove(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('diagnosisId', ParseIntPipe) diagnosisId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.diagnosesService.remove(encounterId, diagnosisId, clinicId);
    return { success: true };
  }
}

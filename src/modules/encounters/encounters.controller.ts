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
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EncountersService } from './encounters.service';
import {
  CreateEncounterDto,
  EncounterListQueryDto,
  UpdateEncounterDto,
  UpdateEncounterStatusDto,
} from './dto/encounter.dto';
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
@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Get()
  @ApiOperation({ summary: 'List encounters (dokter sees own only)' })
  async findAll(
    @ClinicId() clinicId: number,
    @Query() query: EncounterListQueryDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.encountersService.findAll(clinicId, query, user);
    return { success: true, data: result };
  }

  @Post()
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Create encounter (from reservation check-in or walk-in)' })
  async create(
    @ClinicId() clinicId: number,
    @Body() dto: CreateEncounterDto,
    @CurrentUser() user: any,
  ) {
    const encounter = await this.encountersService.create(
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data: encounter };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get encounter detail' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    const encounter = await this.encountersService.findOne(id, clinicId, user);
    return { success: true, data: encounter };
  }

  @Patch(':id')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Update encounter data' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateEncounterDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    req.auditBefore = await this.encountersService.findOne(id, clinicId, user).catch(() => null);
    const encounter = await this.encountersService.update(
      id,
      clinicId,
      dto,
      user,
    );
    return { success: true, data: encounter };
  }

  @Patch(':id/status')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Update encounter status' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateEncounterStatusDto,
    @CurrentUser() user: any,
  ) {
    const encounter = await this.encountersService.updateStatus(
      id,
      clinicId,
      dto,
      user,
    );
    return { success: true, data: encounter };
  }
}

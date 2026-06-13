import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MedicationsService } from './medications.service';
import {
  AdjustStockDto,
  CreateMedicationDto,
  MedicationQueryDto,
  UpdateMedicationDto,
} from './dto/medication.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('medications')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('medications')
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List medications with optional filters' })
  async findAll(
    @ClinicId() clinicId: number,
    @Query() query: MedicationQueryDto,
  ) {
    return this.medicationsService.findAll(clinicId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Add new medication' })
  async create(
    @ClinicId() clinicId: number,
    @Body() dto: CreateMedicationDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.medicationsService.create(
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update medication info' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateMedicationDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.medicationsService.update(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Patch(':id/stock')
  @ApiOperation({ summary: 'Adjust medication stock (in/out/adjustment)' })
  async adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.medicationsService.adjustStock(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}

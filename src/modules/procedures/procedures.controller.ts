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
import { ProceduresService } from './procedures.service';
import { CreateProcedureDto } from './dto/procedure.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/procedures')
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Get()
  @ApiOperation({ summary: 'List procedures for encounter' })
  async findAll(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.proceduresService.findAll(encounterId, clinicId);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Add procedure to encounter' })
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateProcedureDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.proceduresService.create(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete(':procedureId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove procedure from encounter' })
  async remove(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('procedureId', ParseIntPipe) procedureId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.proceduresService.remove(encounterId, procedureId, clinicId);
    return { success: true };
  }
}

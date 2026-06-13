import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DispenseService } from './dispense.service';
import { DispenseMedicationsDto } from './dto/dispense.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/dispense')
export class DispenseController {
  constructor(private readonly dispenseService: DispenseService) {}

  @Post()
  @ApiOperation({ summary: 'Dispense medications for encounter prescriptions' })
  async dispense(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: DispenseMedicationsDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.dispenseService.dispense(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MultiClinicService } from './multi-clinic.service';
import { RespondLinkDto } from './dto/owner-clinic-link.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { SkipSubscriptionCheck } from '../subscriptions/guards/subscription.guard';
import { UserRole } from '../../enums';

/**
 * Halaman Persetujuan (PRD PS-01): owner klinik melihat dan menjawab
 * permintaan hubungan ke akun Multi-Klinik. Owner multiklinik di mode
 * Cabang aktif juga terbaca sebagai owner, tapi ditolak di service.
 */
@ApiTags('multi-clinic')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
// Answering must work even while the clinic's own subscription has lapsed.
@SkipSubscriptionCheck()
@Controller('clinic-links')
export class ClinicLinksController {
  constructor(private readonly multiClinicService: MultiClinicService) {}

  @Get('requests')
  @ApiOperation({ summary: 'Permintaan hubungan multiklinik untuk klinik ini' })
  async list(@ClinicId() clinicId: number) {
    const data = await this.multiClinicService.listRequestsForClinic(clinicId);
    return { success: true, data };
  }

  @Get('current')
  @ApiOperation({ summary: 'Owner multiklinik yang menaungi klinik ini, bila ada' })
  async current(@ClinicId() clinicId: number) {
    const data = await this.multiClinicService.currentLinkForClinic(clinicId);
    return { success: true, data };
  }

  @Post('requests/:id/respond')
  @ApiOperation({
    summary: 'Setujui atau tolak permintaan hubungan multiklinik',
  })
  async respond(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondLinkDto,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    const data = await this.multiClinicService.respond(
      id,
      clinicId,
      dto.approve,
      user,
    );
    return { success: true, data };
  }
}

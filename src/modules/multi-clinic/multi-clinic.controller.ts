import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MultiClinicService } from './multi-clinic.service';
import { LinkClinicDto } from './dto/owner-clinic-link.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';

@ApiTags('multi-clinic')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('multi-clinic')
export class MultiClinicController {
  constructor(private readonly multiClinicService: MultiClinicService) {}

  @Get('my-clinics')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({ summary: 'Daftar klinik milik akun multi-klinik owner ini' })
  async myClinics(@CurrentUser() user: any) {
    const data = await this.multiClinicService.getMyClinics(user.userId);
    return { success: true, data };
  }

  @Get('dashboard')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary: 'Dashboard ringkasan gabungan lintas klinik milik owner ini',
  })
  async dashboard(@CurrentUser() user: any) {
    const data = await this.multiClinicService.getDashboard(user.userId);
    return { success: true, data };
  }

  @Get('owners')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Daftar akun multi-klinik owner beserta klinik miliknya (Super Admin)',
  })
  async owners() {
    const data = await this.multiClinicService.listOwners();
    return { success: true, data };
  }

  @Post('owners/:ownerId/clinics')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Hubungkan klinik ke akun multi-klinik owner (Super Admin)',
  })
  async linkClinic(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() dto: LinkClinicDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.multiClinicService.linkClinic(
      ownerId,
      dto.clinicId,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete('owners/:ownerId/clinics/:clinicId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Putuskan hubungan klinik dari akun multi-klinik owner (Super Admin)',
  })
  async unlinkClinic(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Param('clinicId', ParseIntPipe) clinicId: number,
  ) {
    await this.multiClinicService.unlinkClinic(ownerId, clinicId);
    return { success: true };
  }
}

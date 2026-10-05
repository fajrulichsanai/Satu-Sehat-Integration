import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../../enums/user-role.enum';
import { ApiResponse } from '../../../common/response/api-response';
import { SatusehatAdminService } from './satusehat-admin.service';

@ApiTags('super-admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('super-admin/satusehat')
export class SatusehatAdminController {
  constructor(private readonly admin: SatusehatAdminService) {}

  @Get('clinics')
  @ApiOperation({ summary: 'Kondisi SATUSEHAT seluruh klinik' })
  async overview() {
    return ApiResponse.success(await this.admin.overview());
  }

  @Get('clinics/:id')
  @ApiOperation({ summary: 'Detail kondisi SATUSEHAT satu klinik' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return ApiResponse.success(await this.admin.clinicDetail(id));
  }
}

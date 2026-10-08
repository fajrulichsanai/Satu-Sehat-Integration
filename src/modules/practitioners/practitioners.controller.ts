import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PractitionersService } from './practitioners.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import {
  CreatePractitionerDto,
  UpdatePractitionerDto,
  SearchSatusehatPractitionerDto,
  PractitionerResponseDto,
  PractitionerListResponseDto,
  SatusehatPractitionerSearchResultDto,
  CreatePractitionerAccountDto,
  UpdatePractitionerAccountDto,
} from './dto/practitioner.dto';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('settings')
@Controller('settings/practitioners')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@ApiBearerAuth('JWT-auth')
export class PractitionersController {
  constructor(private readonly practitionersService: PractitionersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all practitioners in clinic' })
  @ApiResponse({
    status: 200,
    description: 'List of practitioners',
    type: PractitionerListResponseDto,
  })
  async findAll(@ClinicId() clinicId: number) {
    return this.practitionersService.findAll(clinicId);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get practitioner by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Practitioner details',
    type: PractitionerResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Practitioner not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return this.practitionersService.findOne(id, clinicId);
  }

  @Post()
  @Audit('Staff', AuditActionType.CREATE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Register new practitioner' })
  @ApiResponse({
    status: 201,
    description: 'Practitioner registered successfully',
  })
  @ApiResponse({ status: 409, description: 'NIK already registered' })
  async create(
    @Body() dto: CreatePractitionerDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.practitionersService.create(dto, clinicId, user.userId);
  }

  @Put(':id')
  @Audit('Staff', AuditActionType.UPDATE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update practitioner' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Practitioner updated' })
  @ApiResponse({ status: 404, description: 'Practitioner not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePractitionerDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
    @Req() req: any,
  ) {
    // Snapshot audit memakai bentuk tersamar (tanpa NIK utuh)
    req.auditBefore = await this.practitionersService
      .findOne(id, clinicId)
      .then((r) => r.data)
      .catch(() => null);
    return this.practitionersService.update(id, dto, clinicId, {
      userId: user.userId,
      name: user.name,
    });
  }

  @Delete(':id')
  @Audit('Staff', AuditActionType.DELETE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete practitioner' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Practitioner deleted' })
  @ApiResponse({ status: 404, description: 'Practitioner not found' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Req() req: any,
  ) {
    req.auditBefore = await this.practitionersService
      .findOne(id, clinicId)
      .then((r) => r.data)
      .catch(() => null);
    return this.practitionersService.remove(id, clinicId);
  }

  @Get(':id/revisions')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Riwayat revisi data tenaga kesehatan' })
  async revisions(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return this.practitionersService.revisions(id, clinicId);
  }

  @Post(':id/match-satusehat')
  @Audit('Staff', AuditActionType.UPDATE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cocokkan nakes dengan SATUSEHAT (NIK → ID IHS + nama resmi)',
  })
  async matchSatusehat(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    return this.practitionersService.matchSatusehat(id, clinicId, {
      userId: user.userId,
      name: user.name,
    });
  }

  @Post(':id/account')
  @Audit('Staff', AuditActionType.UPDATE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Buat akun login (email + password) untuk nakes' })
  async createAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePractitionerAccountDto,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    return this.practitionersService.createAccount(
      id,
      clinicId,
      { ...dto, role: dto.role as UserRole | undefined },
      { userId: user.userId, name: user.name },
    );
  }

  @Patch(':id/account')
  @Audit('Staff', AuditActionType.UPDATE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Ubah email / reset password / (non)aktifkan akun nakes',
  })
  async updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePractitionerAccountDto,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    return this.practitionersService.updateAccount(id, clinicId, dto, {
      userId: user.userId,
      name: user.name,
    });
  }

  @Post('search-satusehat')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Cari nakes di SATUSEHAT: NIK, ID SATUSEHAT, atau nama + jenis kelamin + tanggal lahir',
  })
  @ApiResponse({
    status: 200,
    description: 'Search result from SATUSEHAT',
    type: SatusehatPractitionerSearchResultDto,
  })
  async searchSatusehat(
    @Body() dto: SearchSatusehatPractitionerDto,
    @ClinicId() clinicId: number,
  ) {
    return this.practitionersService.searchSatusehat(dto, clinicId);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
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
} from './dto/practitioner.dto';

@ApiTags('settings')
@Controller('settings/practitioners')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
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
  ) {
    return this.practitionersService.update(id, dto, clinicId, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete practitioner' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Practitioner deleted' })
  @ApiResponse({ status: 404, description: 'Practitioner not found' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return this.practitionersService.remove(id, clinicId);
  }

  @Post('search-satusehat')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Search practitioner in SATUSEHAT by NIK',
    description: 'TODO: Implement actual SATUSEHAT API integration in Phase 8',
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

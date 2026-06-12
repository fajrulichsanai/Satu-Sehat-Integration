import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import {
  CreateLocationDto,
  UpdateLocationDto,
  LocationResponseDto,
  LocationListResponseDto,
} from './dto/location.dto';

@ApiTags('settings')
@Controller('settings/locations')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@ApiBearerAuth('JWT-auth')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DOKTER)
  @ApiOperation({ summary: 'Get all locations in clinic' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, description: 'Filter active locations only' })
  @ApiResponse({
    status: 200,
    description: 'List of locations',
    type: LocationListResponseDto,
  })
  async findAll(
    @ClinicId() clinicId: number,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const isActiveOnly = activeOnly === 'true';
    return this.locationsService.findAll(clinicId, isActiveOnly);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DOKTER)
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Location details',
    type: LocationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return this.locationsService.findOne(id, clinicId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create new location (Owner/Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Location created successfully',
  })
  @ApiResponse({ status: 409, description: 'Location name already exists' })
  async create(
    @Body() dto: CreateLocationDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.locationsService.create(dto, clinicId, user.userId);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update location (Owner/Admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Location updated' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  @ApiResponse({ status: 409, description: 'Location name already exists' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocationDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.locationsService.update(id, dto, clinicId, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete location (Owner/Admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Location deleted' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return this.locationsService.remove(id, clinicId);
  }

  @Post(':id/toggle-active')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate/deactivate location (Owner/Admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Location status toggled' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async toggleActive(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.locationsService.toggleActive(id, clinicId, user.userId);
  }
}

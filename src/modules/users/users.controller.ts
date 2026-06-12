import { Controller, Get, Post, Delete, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { UserListResponseDto, UserResponseDto } from './dto/user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all users in clinic (Owner only)' })
  @ApiResponse({ status: 200, description: 'User list', type: UserListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner only' })
  async findAll(
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.usersService.findAll(clinicId, user.role);
  }

  @Get(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get user by ID (Owner only)' })
  @ApiResponse({ status: 200, description: 'User details', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return this.usersService.findOne(id, clinicId);
  }

  @Post(':id/activate')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Activate pending user (Owner only)' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User already active or invalid status' })
  async activate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.usersService.activate(id, clinicId, user.userId);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Deactivate active user (Owner only)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Cannot deactivate owner' })
  @ApiResponse({ status: 409, description: 'User already inactive' })
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.usersService.deactivate(id, clinicId, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete/reject pending user (Owner only)' })
  @ApiResponse({ status: 200, description: 'Pending user deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Can only delete pending users' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return this.usersService.remove(id, clinicId);
  }
}

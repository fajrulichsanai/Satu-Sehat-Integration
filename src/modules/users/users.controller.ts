import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  Logger,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import {
  UserListResponseDto,
  UserResponseDto,
  UpdateUserRoleDto,
  AssignUserRoleDto,
  RoleItemDto,
} from './dto/user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all users in clinic (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'User list',
    type: UserListResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner only' })
  async findAll(@CurrentUser() user: any, @ClinicId() clinicId: number) {
    this.logger.log(`[GET /users] Request masuk | clinicId=${clinicId}, requestedBy=${user.userId}`);
    const result = await this.usersService.findAll(clinicId, user.role);
    this.logger.log(`[GET /users] Response dikirim | clinicId=${clinicId}`);
    return result;
  }

  @Get('roles')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all available roles (excluding pending)' })
  @ApiResponse({
    status: 200,
    description: 'List of roles',
    type: [RoleItemDto],
  })
  getRoles() {
    this.logger.log('[GET /users/roles] Request masuk');
    const result = this.usersService.getRoles();
    this.logger.log('[GET /users/roles] Response dikirim');
    return result;
  }

  @Get('pending/list')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all pending users in clinic (Owner only)' })
  @ApiQuery({ name: 'email', required: false, description: 'Filter by email (partial match)' })
  @ApiResponse({
    status: 200,
    description: 'Pending users list',
    type: UserListResponseDto,
  })
  async findPending(
    @ClinicId() clinicId: number,
    @Query('email') email?: string,
  ) {
    this.logger.log(`[GET /users/pending/list] Request masuk | clinicId=${clinicId}${email ? `, email=${email}` : ''}`);
    const result = await this.usersService.findPending(clinicId, email);
    this.logger.log(`[GET /users/pending/list] Response dikirim | clinicId=${clinicId}`);
    return result;
  }

  @Get(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get user by ID (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    this.logger.log(`[GET /users/:id] Request masuk | userId=${id}, clinicId=${clinicId}`);
    const result = await this.usersService.findOne(id, clinicId);
    this.logger.log(`[GET /users/:id] Response dikirim | userId=${id}`);
    return result;
  }

  @Post(':id/activate')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Activate pending user (Owner only)' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description: 'User already active or invalid status',
  })
  async activate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    this.logger.log(`[POST /users/:id/activate] Request masuk | userId=${id}, clinicId=${clinicId}, requestedBy=${user.userId}`);
    const result = await this.usersService.activate(id, clinicId, user.userId);
    this.logger.log(`[POST /users/:id/activate] Response dikirim | userId=${id}`);
    return result;
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
    this.logger.log(`[POST /users/:id/deactivate] Request masuk | userId=${id}, clinicId=${clinicId}, requestedBy=${user.userId}`);
    const result = await this.usersService.deactivate(id, clinicId, user.userId);
    this.logger.log(`[POST /users/:id/deactivate] Response dikirim | userId=${id}`);
    return result;
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
    this.logger.log(`[DELETE /users/:id] Request masuk | userId=${id}, clinicId=${clinicId}`);
    const result = await this.usersService.remove(id, clinicId);
    this.logger.log(`[DELETE /users/:id] Response dikirim | userId=${id}`);
    return result;
  }

  @Patch(':id/role')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Update pending user role to admin/dokter (Owner only)',
  })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User status invalid' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
    @ClinicId() clinicId: number,
  ) {
    this.logger.log(`[PATCH /users/:id/role] Request masuk | userId=${id}, clinicId=${clinicId}, newRole=${dto.role}`);
    const result = await this.usersService.updateRole(id, clinicId, dto.role);
    this.logger.log(`[PATCH /users/:id/role] Response dikirim | userId=${id}`);
    return result;
  }

  @Patch(':id/assign-role')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Assign role to any active user (Owner only)' })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid role' })
  async assignRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignUserRoleDto,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`[PATCH /users/:id/assign-role] Request masuk | userId=${id}, clinicId=${clinicId}, newRole=${dto.role}, requestedBy=${user.userId}`);
    const result = await this.usersService.assignRole(id, clinicId, dto.role, user.userId);
    this.logger.log(`[PATCH /users/:id/assign-role] Response dikirim | userId=${id}`);
    return result;
  }
}

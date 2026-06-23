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
import { UserRole } from '../../enums';
import {
  UserListResponseDto,
  UserResponseDto,
  UpdateUserRoleDto,
  AssignUserRoleDto,
  RoleItemDto,
  InviteUserDto,
  UpdateUserDto,
} from './dto/user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all users (Owner: own clinic, Super Admin: all)' })
  @ApiResponse({
    status: 200,
    description: 'User list',
    type: UserListResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(@CurrentUser() user: any) {
    this.logger.log(`[GET /users] Request masuk | requestedBy=${user.userId}`);
    const result = await this.usersService.findAll(user);
    this.logger.log(`[GET /users] Response dikirim`);
    return result;
  }

  @Get('roles')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all available roles assignable by the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of roles',
    type: [RoleItemDto],
  })
  getRoles(@CurrentUser() user: any) {
    this.logger.log('[GET /users/roles] Request masuk');
    const result = this.usersService.getRoles(user);
    this.logger.log('[GET /users/roles] Response dikirim');
    return result;
  }

  @Get('pending/list')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all pending users (Owner: own clinic, Super Admin: all)' })
  @ApiQuery({ name: 'email', required: false, description: 'Filter by email (partial match)' })
  @ApiResponse({
    status: 200,
    description: 'Pending users list',
    type: UserListResponseDto,
  })
  async findPending(
    @CurrentUser() user: any,
    @Query('email') email?: string,
  ) {
    this.logger.log(`[GET /users/pending/list] Request masuk${email ? ` | email=${email}` : ''}`);
    const result = await this.usersService.findPending(user, email);
    this.logger.log(`[GET /users/pending/list] Response dikirim`);
    return result;
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`[GET /users/:id] Request masuk | userId=${id}`);
    const result = await this.usersService.findOne(id, user);
    this.logger.log(`[GET /users/:id] Response dikirim | userId=${id}`);
    return result;
  }

  @Post('invite')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create/invite a new user directly with a role' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already used' })
  @ApiResponse({ status: 403, description: 'Cannot assign this role' })
  async invite(@Body() dto: InviteUserDto, @CurrentUser() user: any) {
    this.logger.log(`[POST /users/invite] Request masuk | email=${dto.email}, role=${dto.role}, requestedBy=${user.userId}`);
    const result = await this.usersService.invite(dto, user);
    this.logger.log(`[POST /users/invite] Response dikirim | email=${dto.email}`);
    return result;
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user name/email' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already used' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`[PATCH /users/:id] Request masuk | userId=${id}, requestedBy=${user.userId}`);
    const result = await this.usersService.update(id, dto, user);
    this.logger.log(`[PATCH /users/:id] Response dikirim | userId=${id}`);
    return result;
  }

  @Post(':id/activate')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate pending user' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description: 'User already active or invalid status',
  })
  async activate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`[POST /users/:id/activate] Request masuk | userId=${id}, requestedBy=${user.userId}`);
    const result = await this.usersService.activate(id, user);
    this.logger.log(`[POST /users/:id/activate] Response dikirim | userId=${id}`);
    return result;
  }

  @Post(':id/deactivate')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate active user' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Cannot deactivate owner' })
  @ApiResponse({ status: 409, description: 'User already inactive' })
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`[POST /users/:id/deactivate] Request masuk | userId=${id}, requestedBy=${user.userId}`);
    const result = await this.usersService.deactivate(id, user);
    this.logger.log(`[POST /users/:id/deactivate] Response dikirim | userId=${id}`);
    return result;
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a user (pending or active)' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`[DELETE /users/:id] Request masuk | userId=${id}, requestedBy=${user.userId}`);
    const result = await this.usersService.remove(id, user);
    this.logger.log(`[DELETE /users/:id] Response dikirim | userId=${id}`);
    return result;
  }

  @Patch(':id/role')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update pending user role to admin/dokter/owner',
  })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User status invalid' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`[PATCH /users/:id/role] Request masuk | userId=${id}, newRole=${dto.role}`);
    const result = await this.usersService.updateRole(id, dto.role, user);
    this.logger.log(`[PATCH /users/:id/role] Response dikirim | userId=${id}`);
    return result;
  }

  @Patch(':id/assign-role')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign role to any active user' })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid role' })
  async assignRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignUserRoleDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`[PATCH /users/:id/assign-role] Request masuk | userId=${id}, newRole=${dto.role}, requestedBy=${user.userId}`);
    const result = await this.usersService.assignRole(id, dto.role, user);
    this.logger.log(`[PATCH /users/:id/assign-role] Response dikirim | userId=${id}`);
    return result;
  }
}

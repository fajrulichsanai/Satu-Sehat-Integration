import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  Query,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import {
  RegisterDto,
  LoginDto,
  LoginResponseDto,
  UserResponseDto,
  ActivationStatusResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  MfaVerifyLoginDto,
  MfaEnableDto,
  MfaDisableDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { UserRole } from '../../enums';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditActionType,
  AuditStatus,
} from '../audit-log/entities/audit-log.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(@Body() dto: RegisterDto) {
    console.log(`Received registration request for email: ${dto.email}`);
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    console.log(`Received login request for email: ${dto.email}`);
    try {
      const result = await this.authService.login(dto);
      const loggedInUser = (result?.data as { user?: any })?.user;
      void this.auditLogService.record({
        clinicId: loggedInUser?.clinicId ?? null,
        actorId: loggedInUser?.id ?? null,
        actorName: loggedInUser?.name ?? dto.email ?? 'Unknown',
        actorRole: loggedInUser?.role ?? 'unknown',
        actionType: AuditActionType.LOGIN,
        entityType: 'Auth',
        status: AuditStatus.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      return result;
    } catch (err) {
      void this.auditLogService.record({
        clinicId: null,
        actorId: null,
        actorName: dto.email ?? 'Unknown',
        actorRole: 'unknown',
        actionType: AuditActionType.LOGIN,
        entityType: 'Auth',
        status: AuditStatus.FAILED,
        failureReason: (err as Error)?.message?.slice(0, 255),
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      throw err;
    }
  }

  @Public()
  @Post('mfa/verify-login')
  @ApiOperation({
    summary:
      'Second step of login for accounts with MFA enabled: exchange the mfaToken from /auth/login plus a code for the real access token',
  })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid code or expired token' })
  async verifyMfaLogin(@Body() dto: MfaVerifyLoginDto, @Req() req: any) {
    try {
      const result = await this.authService.verifyMfaLogin(
        dto.mfaToken!,
        dto.code!,
      );
      const loggedInUser = result?.data?.user;
      void this.auditLogService.record({
        clinicId: loggedInUser?.clinicId ?? null,
        actorId: loggedInUser?.id ?? null,
        actorName: loggedInUser?.name ?? 'Unknown',
        actorRole: loggedInUser?.role ?? 'unknown',
        actionType: AuditActionType.LOGIN,
        entityType: 'Auth',
        entityLabel: 'MFA',
        status: AuditStatus.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      return result;
    } catch (err) {
      void this.auditLogService.record({
        clinicId: null,
        actorId: null,
        actorName: 'Unknown',
        actorRole: 'unknown',
        actionType: AuditActionType.LOGIN,
        entityType: 'Auth',
        entityLabel: 'MFA',
        status: AuditStatus.FAILED,
        failureReason: (err as Error)?.message?.slice(0, 255),
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      throw err;
    }
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Whether MFA is currently enabled for the caller' })
  async getMfaStatus(@CurrentUser() user: any) {
    const data = await this.mfaService.getStatus(user.userId);
    return { success: true, data };
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Starts MFA enrollment: generates a new secret and returns a QR code to scan with an authenticator app',
  })
  async setupMfa(@CurrentUser() user: any) {
    const data = await this.mfaService.setup(user.userId);
    return { success: true, data };
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Confirms MFA enrollment with a code from the authenticator app and turns MFA on; returns one-time backup codes',
  })
  async enableMfa(@CurrentUser() user: any, @Body() dto: MfaEnableDto, @Req() req: any) {
    const data = await this.mfaService.enable(user.userId, dto.code!);
    void this.auditLogService.record({
      clinicId: user.clinicId ?? null,
      actorId: user.userId,
      actorName: user.name ?? user.email ?? 'Unknown',
      actorRole: user.role,
      actionType: AuditActionType.UPDATE,
      entityType: 'User',
      entityId: user.userId,
      entityLabel: 'MFA enabled',
      status: AuditStatus.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return { success: true, data };
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Disables MFA after confirming the password' })
  async disableMfa(@CurrentUser() user: any, @Body() dto: MfaDisableDto, @Req() req: any) {
    await this.mfaService.disable(user.userId, dto.password!);
    void this.auditLogService.record({
      clinicId: user.clinicId ?? null,
      actorId: user.userId,
      actorName: user.name ?? user.email ?? 'Unknown',
      actorRole: user.role,
      actionType: AuditActionType.UPDATE,
      entityType: 'User',
      entityId: user.userId,
      entityLabel: 'MFA disabled',
      status: AuditStatus.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.userId);
  }

  @Get('activation-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Check account activation status (for polling after register)',
  })
  @ApiResponse({ status: 200, type: ActivationStatusResponseDto })
  async getActivationStatus(@CurrentUser() user: any) {
    console.log(
      `Received request for activation status of user ${user.userId}`,
    );
    return this.authService.getActivationStatus(user.userId);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  async refresh(@CurrentUser() user: any) {
    return this.authService.refreshToken(user.userId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout (client should discard token)' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@CurrentUser() user: any, @Req() req: any) {
    void this.auditLogService.record({
      clinicId: user?.clinicId ?? null,
      actorId: user?.userId ?? null,
      actorName: user?.name ?? 'Unknown',
      actorRole: user?.role ?? 'unknown',
      actionType: AuditActionType.LOGOUT,
      entityType: 'Auth',
      status: AuditStatus.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return this.authService.logout();
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with token sent to email' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset link via email' })
  @ApiResponse({ status: 200, description: 'Reset link sent if email exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email!);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token sent to email' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token!, dto.password!);
  }

  @Post('impersonate/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Super Admin: issue a short-lived token to act as another user, for support/debugging (audited)',
  })
  @ApiResponse({ status: 200, description: 'Impersonation token issued' })
  async impersonate(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() admin: any,
    @Req() req: any,
  ) {
    const result = await this.authService.impersonate(userId);
    const target = result?.data?.user;
    void this.auditLogService.record({
      clinicId: target?.clinicId ?? null,
      actorId: admin.userId,
      actorName: admin.name ?? admin.email ?? 'Super Admin',
      actorRole: admin.role,
      actionType: AuditActionType.LOGIN,
      entityType: 'Impersonation',
      entityId: target?.id ?? null,
      entityLabel: target ? `${target.name} (${target.email})` : null,
      afterValue: target
        ? {
            impersonatedUserId: target.id,
            impersonatedUserEmail: target.email,
            impersonatedUserRole: target.role,
            impersonatedClinicId: target.clinicId,
          }
        : null,
      status: AuditStatus.SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }
}

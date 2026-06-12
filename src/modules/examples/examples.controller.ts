import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';

/**
 * Example controller demonstrating guard usage
 * This shows how to protect endpoints with different authorization levels
 */
@ApiTags('examples')
@Controller('examples')
@UseGuards(JwtAuthGuard) // All routes require authentication
export class ExamplesController {
  /**
   * Example 1: Any authenticated user can access
   */
  @Get('public-authed')
  @ApiOperation({ summary: 'Any authenticated user (demo)' })
  @ApiBearerAuth('JWT-auth')
  async publicAuthed(@CurrentUser() user: any) {
    return {
      success: true,
      data: {
        message: 'Accessible by any authenticated user',
        user: {
          id: user.userId,
          role: user.role,
        },
      },
    };
  }

  /**
   * Example 2: Only OWNER can access
   */
  @Get('owner-only')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Owner only (demo)' })
  @ApiBearerAuth('JWT-auth')
  async ownerOnly(@CurrentUser() user: any) {
    return {
      success: true,
      data: {
        message: 'Accessible by OWNER only',
        user: {
          id: user.userId,
          role: user.role,
        },
      },
    };
  }

  /**
   * Example 3: OWNER or ADMIN can access
   */
  @Get('admin-access')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Owner or Admin (demo)' })
  @ApiBearerAuth('JWT-auth')
  async adminAccess(@CurrentUser() user: any) {
    return {
      success: true,
      data: {
        message: 'Accessible by OWNER or ADMIN',
        user: {
          id: user.userId,
          role: user.role,
        },
      },
    };
  }

  /**
   * Example 4: With clinic context (multi-tenant)
   */
  @Get('clinic-data')
  @UseGuards(RolesGuard, ClinicContextGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DOKTER)
  @ApiOperation({ summary: 'Clinic-scoped data (demo)' })
  @ApiBearerAuth('JWT-auth')
  async clinicData(
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: {
        message: 'Data filtered by clinic context',
        clinicId,
        user: {
          id: user.userId,
          role: user.role,
        },
      },
    };
  }

  /**
   * Example 5: Dokter can only see their own data
   */
  @Get('my-patients')
  @UseGuards(RolesGuard, ClinicContextGuard)
  @Roles(UserRole.DOKTER)
  @ApiOperation({ summary: 'Dokter\'s patients only (demo)' })
  @ApiBearerAuth('JWT-auth')
  async myPatients(
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: {
        message: 'Dokter sees only their patients',
        clinicId,
        practitionerId: user.practitionerId,
        note: 'In real implementation, filter by practitionerId',
      },
    };
  }
}

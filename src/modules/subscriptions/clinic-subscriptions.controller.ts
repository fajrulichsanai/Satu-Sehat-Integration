import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicSubscriptionsService } from './clinic-subscriptions.service';
import {
  ClinicSubscriptionQueryDto,
  ManualExtendDto,
} from './dto/clinic-subscription.dto';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { SkipSubscriptionCheck } from './guards/subscription.guard';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('subscriptions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@SkipSubscriptionCheck()
@Controller('clinic-subscriptions')
export class ClinicSubscriptionsController {
  constructor(
    private readonly clinicSubscriptionsService: ClinicSubscriptionsService,
  ) {}

  @Get('current')
  @ApiOperation({
    summary: "Get the caller's clinic current subscription status",
  })
  getCurrent(@ClinicId() clinicId: number) {
    return this.clinicSubscriptionsService.getCurrentForClinic(clinicId);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'List every clinic with its current subscription status (Super Admin only)',
  })
  listAll(@Query() query: ClinicSubscriptionQueryDto) {
    return this.clinicSubscriptionsService.listAll(query);
  }

  @Get('clinic/:clinicId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Get subscription renewal history for one clinic (Super Admin only)',
  })
  getHistory(@Param('clinicId', ParseIntPipe) clinicId: number) {
    return this.clinicSubscriptionsService.getHistoryForClinic(clinicId);
  }

  @Post('extend')
  @Roles(UserRole.SUPER_ADMIN)
  @Audit('ClinicSubscription', AuditActionType.CREATE, { labelField: 'id' })
  @ApiOperation({
    summary:
      'Manually extend/activate a clinic subscription (Super Admin only)',
  })
  extend(@Body() dto: ManualExtendDto, @CurrentUser() user: any) {
    return this.clinicSubscriptionsService.extendSubscription(
      dto.clinicId,
      dto.planId,
      user.userId,
      dto.notes,
    );
  }
}

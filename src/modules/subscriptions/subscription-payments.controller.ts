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
import { SubscriptionPaymentsService } from './subscription-payments.service';
import {
  CreateSubscriptionPaymentDto,
  ReviewSubscriptionPaymentDto,
  SubscriptionPaymentQueryDto,
} from './dto/subscription-payment.dto';
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
@Controller('subscription-payments')
export class SubscriptionPaymentsController {
  constructor(private readonly paymentsService: SubscriptionPaymentsService) {}

  @Post()
  @Audit('SubscriptionPayment', AuditActionType.CREATE, { labelField: 'id' })
  @ApiOperation({
    summary: "Clinic claims 'I have paid' for a plan (any clinic user)",
  })
  claim(
    @Body() dto: CreateSubscriptionPaymentDto,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.claim(clinicId, dto, user.userId);
  }

  @Get('mine')
  @ApiOperation({ summary: "List the caller's clinic payment claim history" })
  listMine(
    @ClinicId() clinicId: number,
    @Query() query: SubscriptionPaymentQueryDto,
  ) {
    return this.paymentsService.listMine(clinicId, query);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List the payment confirmation queue (Super Admin only)',
  })
  listQueue(@Query() query: SubscriptionPaymentQueryDto) {
    return this.paymentsService.listQueue(query);
  }

  @Post(':id/confirm')
  @Roles(UserRole.SUPER_ADMIN)
  @Audit('SubscriptionPayment', AuditActionType.UPDATE, { labelField: 'id' })
  @ApiOperation({
    summary:
      'Confirm a payment claim and extend the subscription (Super Admin only)',
  })
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewSubscriptionPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.confirm(id, dto, user.userId);
  }

  @Post(':id/reject')
  @Roles(UserRole.SUPER_ADMIN)
  @Audit('SubscriptionPayment', AuditActionType.UPDATE, { labelField: 'id' })
  @ApiOperation({ summary: 'Reject a payment claim (Super Admin only)' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewSubscriptionPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.reject(id, dto, user.userId);
  }
}

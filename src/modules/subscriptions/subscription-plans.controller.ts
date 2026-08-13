import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionPlansService } from './subscription-plans.service';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from './dto/subscription-plan.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';
import { SkipSubscriptionCheck } from './guards/subscription.guard';

@ApiTags('subscriptions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@SkipSubscriptionCheck()
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List subscription plans (any authenticated user)' })
  findAll() {
    return this.plansService.findAll();
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create subscription plan (Super Admin only)' })
  create(@Body() dto: CreateSubscriptionPlanDto, @CurrentUser() user: any) {
    return this.plansService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update subscription plan (Super Admin only)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionPlanDto,
    @CurrentUser() user: any,
  ) {
    return this.plansService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate subscription plan (Super Admin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.remove(id);
  }
}

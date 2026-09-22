import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's clinic recent notifications" })
  async list(
    @ClinicId() clinicId: number,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const [items, unreadCount] = await Promise.all([
      this.notificationsService.listForClinic(clinicId, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? Number(limit) : undefined,
      }),
      this.notificationsService.countUnread(clinicId),
    ]);

    return { success: true, data: { items, unreadCount } };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    await this.notificationsService.markRead(id, clinicId);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({
    summary: "Mark every one of the caller's clinic notifications as read",
  })
  async markAllRead(@ClinicId() clinicId: number) {
    await this.notificationsService.markAllRead(clinicId);
    return { success: true };
  }
}

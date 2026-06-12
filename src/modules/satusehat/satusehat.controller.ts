import {
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyncOrchestratorService } from './sync/sync-orchestrator.service';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums/user-role.enum';

@ApiTags('satusehat')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard, RolesGuard)
@Roles(UserRole.OWNER)
@Controller('satusehat')
export class SatusehatController {
  constructor(private readonly syncOrchestrator: SyncOrchestratorService) {}

  @Post('sync/:resourceType/:localId')
  @ApiOperation({ summary: 'Manual sync a resource to SATUSEHAT' })
  async manualSync(
    @Param('resourceType') resourceType: string,
    @Param('localId', ParseIntPipe) localId: number,
    @ClinicId() clinicId: number,
  ) {
    const result = await this.syncOrchestrator.syncResource(resourceType, localId, clinicId);
    return { success: result.success, data: result };
  }
}

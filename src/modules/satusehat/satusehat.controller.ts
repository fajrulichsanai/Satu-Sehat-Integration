import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyncOrchestratorService } from './sync/sync-orchestrator.service';
import { SyncQueueService } from './sync/sync-queue.service';
import { SatusehatMonitorService } from './monitor/satusehat-monitor.service';
import {
  ListResourcesQueryDto,
  ListSyncLogsQueryDto,
  SATUSEHAT_RESOURCE_TYPES,
  SatusehatResourceType,
} from './monitor/dto/monitor.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums/user-role.enum';
import { ApiResponse } from '../../common/response/api-response';

/** Ambil pesan yang bisa dibaca dari OperationOutcome FHIR bila ada. */
function readableError(error?: string): string {
  if (!error) return 'tidak diketahui';
  try {
    const parsed = JSON.parse(error) as {
      issue?: { details?: { text?: string }; diagnostics?: string }[];
    };
    const texts = (parsed.issue ?? [])
      .map((i) => i.details?.text || i.diagnostics)
      .filter(Boolean);
    if (texts.length) return texts.join('; ');
  } catch {
    // bukan JSON
  }
  return error.length > 300 ? `${error.slice(0, 300)}…` : error;
}

@ApiTags('satusehat')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard, RolesGuard)
@Roles(UserRole.OWNER)
@Controller('satusehat')
export class SatusehatController {
  constructor(
    private readonly syncOrchestrator: SyncOrchestratorService,
    private readonly syncQueue: SyncQueueService,
    private readonly monitor: SatusehatMonitorService,
  ) {}

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Ringkasan status integrasi & sinkronisasi SATUSEHAT klinik',
  })
  async getSummary(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.monitor.getSummary(clinicId));
  }

  @Get('resources/:resourceType')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Daftar data lokal per resource beserta status sync SATUSEHAT',
  })
  async listResources(
    @Param('resourceType') resourceType: string,
    @Query() query: ListResourcesQueryDto,
    @ClinicId() clinicId: number,
  ) {
    if (
      !SATUSEHAT_RESOURCE_TYPES.includes(resourceType as SatusehatResourceType)
    ) {
      throw new BadRequestException(
        `resourceType harus salah satu dari: ${SATUSEHAT_RESOURCE_TYPES.join(', ')}`,
      );
    }
    return ApiResponse.success(
      await this.monitor.listResources(
        resourceType as SatusehatResourceType,
        clinicId,
        query,
      ),
    );
  }

  @Get('sync-logs')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Riwayat pengiriman data ke SATUSEHAT' })
  async listSyncLogs(
    @Query() query: ListSyncLogsQueryDto,
    @ClinicId() clinicId: number,
  ) {
    return ApiResponse.success(
      await this.monitor.listSyncLogs(clinicId, query),
    );
  }

  @Get('sync-logs/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Detail log sync (payload request & response)' })
  async getSyncLog(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return ApiResponse.success(await this.monitor.getSyncLog(clinicId, id));
  }

  @Post('sync-queue/process')
  @ApiOperation({ summary: 'Proses ulang antrean sync yang tertunda' })
  async processQueue(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.syncQueue.processPending(clinicId));
  }

  @Post('sync/:resourceType/:localId')
  @ApiOperation({ summary: 'Manual sync a resource to SATUSEHAT' })
  async manualSync(
    @Param('resourceType') resourceType: string,
    @Param('localId', ParseIntPipe) localId: number,
    @ClinicId() clinicId: number,
  ) {
    // Terima juga huruf kecil (mis. /satusehat/sync/encounter/1 dari halaman kunjungan)
    const canonical =
      SATUSEHAT_RESOURCE_TYPES.find(
        (t) => t.toLowerCase() === resourceType.toLowerCase(),
      ) ?? resourceType;
    const result = await this.syncOrchestrator.syncResource(
      canonical,
      localId,
      clinicId,
    );
    if (!result.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'SATUSEHAT_SYNC_FAILED',
          message: `Gagal mengirim ${canonical} ke SATUSEHAT: ${readableError(result.error)}`,
        },
      });
    }
    return { success: true, data: result };
  }
}

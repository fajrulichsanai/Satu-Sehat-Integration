import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyncOrchestratorService } from './sync/sync-orchestrator.service';
import { SyncQueueService } from './sync/sync-queue.service';
import { SatusehatMonitorService } from './monitor/satusehat-monitor.service';
import { SatusehatConfigService } from './satusehat-config.service';
import { SaveSatusehatConfigDto } from './dto/satusehat-config.dto';
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums/user-role.enum';
import { ApiResponse } from '../../common/response/api-response';
import { readableFhirError } from './fhir/fhir-error';

const OWNERS = [UserRole.OWNER, UserRole.MULTI_CLINIC_OWNER];
const VIEWERS = [...OWNERS, UserRole.ADMIN];

@ApiTags('satusehat')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard, RolesGuard)
@Roles(...OWNERS)
@Controller('satusehat')
export class SatusehatController {
  constructor(
    private readonly syncOrchestrator: SyncOrchestratorService,
    private readonly syncQueue: SyncQueueService,
    private readonly monitor: SatusehatMonitorService,
    private readonly config: SatusehatConfigService,
  ) {}

  // ── Konfigurasi klinik ────────────────────────────────────────────────

  @Get('config')
  @Roles(...VIEWERS)
  @ApiOperation({
    summary: 'Status konfigurasi SATUSEHAT klinik (tanpa secret)',
  })
  async getConfig(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.config.get(clinicId));
  }

  @Put('config')
  @ApiOperation({ summary: 'Simpan kredensial SATUSEHAT klinik' })
  async saveConfig(
    @Body() dto: SaveSatusehatConfigDto,
    @ClinicId() clinicId: number,
    @CurrentUser() user: { userId: number },
  ) {
    return ApiResponse.success(
      await this.config.save(clinicId, dto, user.userId),
      'Konfigurasi SATUSEHAT disimpan',
    );
  }

  @Post('config/test')
  @ApiOperation({ summary: 'Uji koneksi: minta token OAuth ke SATUSEHAT' })
  async testConfig(@ClinicId() clinicId: number) {
    return ApiResponse.success(
      await this.config.test(clinicId),
      'Koneksi ke SATUSEHAT berhasil',
    );
  }

  // ── Monitoring ────────────────────────────────────────────────────────

  @Get('summary')
  @Roles(...VIEWERS)
  @ApiOperation({
    summary: 'Ringkasan status integrasi & sinkronisasi SATUSEHAT klinik',
  })
  async getSummary(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.monitor.getSummary(clinicId));
  }

  @Get('resources/:resourceType')
  @Roles(...VIEWERS)
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
  @Roles(...VIEWERS)
  @ApiOperation({ summary: 'Riwayat pengiriman data ke SATUSEHAT' })
  async listSyncLogs(
    @Query() query: ListSyncLogsQueryDto,
    @ClinicId() clinicId: number,
  ) {
    return ApiResponse.success(
      await this.monitor.listSyncLogs(clinicId, query),
    );
  }

  // ── Pengiriman ────────────────────────────────────────────────────────

  @Post('sync-queue/process')
  @ApiOperation({ summary: 'Proses ulang antrean sync yang tertunda' })
  async processQueue(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.syncQueue.processPending(clinicId));
  }

  @Post('encounters/:encounterId/sync')
  @ApiOperation({
    summary:
      'Kirim seluruh data kunjungan sesuai Playbook RME Rawat Jalan (laporan per langkah)',
  })
  async syncEncounterFull(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    return ApiResponse.success(
      await this.syncOrchestrator.syncEncounterFull(encounterId, clinicId),
    );
  }

  @Post('sync/:resourceType/:localId')
  @ApiOperation({ summary: 'Kirim satu data ke SATUSEHAT' })
  async manualSync(
    @Param('resourceType') resourceType: string,
    @Param('localId', ParseIntPipe) localId: number,
    @ClinicId() clinicId: number,
  ) {
    // Terima juga huruf kecil (mis. /satusehat/sync/encounter/1)
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
          message: `Gagal mengirim ${canonical} ke SATUSEHAT: ${readableFhirError(result.error)}`,
        },
      });
    }
    return { success: true, data: result };
  }
}

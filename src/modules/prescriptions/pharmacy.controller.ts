import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';
import { RequireFeature } from '../features/require-feature.decorator';
import { PharmacyService } from './pharmacy.service';
import { PharmacyQueueQueryDto } from './dto/pharmacy-query.dto';

@ApiTags('pharmacy')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@RequireFeature('farmasi')
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Get('queue')
  @Audit('Prescription', AuditActionType.VIEW)
  @ApiOperation({
    summary: 'Antrean farmasi: kunjungan berresep + progres penyerahan obat',
  })
  async queue(
    @ClinicId() clinicId: number,
    @Query() query: PharmacyQueueQueryDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.pharmacyService.queue(clinicId, query, user);
    // Tanpa `success`: amplop paginasi { data, stats, meta } diteruskan utuh ke klien
    return result;
  }
}

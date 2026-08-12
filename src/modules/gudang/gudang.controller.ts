import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GudangService } from './gudang.service';
import { BarangQueryDto, CreateBarangDto, UpdateBarangDto } from './dto/barang.dto';
import {
  CreateStokTransaksiDto,
  StokTransaksiQueryDto,
} from './dto/stok-transaksi.dto';
import {
  CreateTindakanBomDto,
  TindakanBomQueryDto,
  UpdateTindakanBomDto,
} from './dto/tindakan-bom.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('gudang')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('gudang')
export class GudangController {
  constructor(private readonly gudangService: GudangService) {}

  // ── Barang ──────────────────────────────────────────────────────────────

  @Get('barang')
  @ApiOperation({ summary: 'List barang' })
  async findBarang(@ClinicId() clinicId: number, @Query() query: BarangQueryDto) {
    const result = await this.gudangService.findAllBarang(clinicId, query);
    return { success: true, data: result };
  }

  @Get('barang/:id')
  @ApiOperation({ summary: 'Get barang detail' })
  async findOneBarang(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.gudangService.findOneBarang(id, clinicId);
    return { success: true, data };
  }

  @Post('barang')
  @Audit('Barang', AuditActionType.CREATE, { labelField: 'name' })
  @ApiOperation({ summary: 'Create barang' })
  async createBarang(
    @ClinicId() clinicId: number,
    @Body() dto: CreateBarangDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.gudangService.createBarang(clinicId, dto, user.userId);
    return { success: true, data };
  }

  @Patch('barang/:id')
  @Audit('Barang', AuditActionType.UPDATE, { labelField: 'name' })
  @ApiOperation({ summary: 'Update barang' })
  async updateBarang(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateBarangDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    req.auditBefore = await this.gudangService.findOneBarang(id, clinicId);
    const data = await this.gudangService.updateBarang(id, clinicId, dto, user.userId);
    return { success: true, data };
  }

  @Delete('barang/:id')
  @Audit('Barang', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Nonaktifkan barang' })
  async removeBarang(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    const existing = await this.gudangService.findOneBarang(id, clinicId);
    void existing;
    await this.gudangService.removeBarang(id, clinicId, user.userId);
    return { success: true, data: { success: true } };
  }

  // ── Stok Transaksi ──────────────────────────────────────────────────────

  @Get('transaksi')
  @ApiOperation({ summary: 'List transaksi stok' })
  async findTransaksi(
    @ClinicId() clinicId: number,
    @Query() query: StokTransaksiQueryDto,
  ) {
    const result = await this.gudangService.findAllTransaksi(clinicId, query);
    return { success: true, data: result };
  }

  @Post('transaksi')
  @Audit('StokTransaksi', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Buat transaksi stok (in/out/adjustment/expired)' })
  async createTransaksi(
    @ClinicId() clinicId: number,
    @Body() dto: CreateStokTransaksiDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.gudangService.createTransaksi(clinicId, dto, user.userId);
    return { success: true, data };
  }

  // ── BOM (Resep Bahan per Tindakan) ─────────────────────────────────────

  @Get('bom')
  @ApiOperation({ summary: 'List resep bahan untuk sebuah tarif/tindakan' })
  async findBom(@ClinicId() clinicId: number, @Query() query: TindakanBomQueryDto) {
    const data = await this.gudangService.findBomByTarif(clinicId, query.tarifId);
    return { success: true, data };
  }

  @Post('bom')
  @Audit('TindakanBom', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Tambah bahan ke resep tindakan' })
  async createBom(
    @ClinicId() clinicId: number,
    @Body() dto: CreateTindakanBomDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.gudangService.createBom(clinicId, dto, user.userId);
    return { success: true, data };
  }

  @Patch('bom/:id')
  @Audit('TindakanBom', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Update resep bahan tindakan' })
  async updateBom(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateTindakanBomDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.gudangService.updateBom(id, clinicId, dto, user.userId);
    return { success: true, data };
  }

  @Delete('bom/:id')
  @Audit('TindakanBom', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus bahan dari resep tindakan' })
  async removeBom(@Param('id', ParseIntPipe) id: number, @ClinicId() clinicId: number) {
    await this.gudangService.removeBom(id, clinicId);
    return { success: true, data: { success: true } };
  }

  // ── Dashboard ───────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Ringkasan dashboard gudang' })
  async getDashboard(@ClinicId() clinicId: number) {
    const data = await this.gudangService.getDashboard(clinicId);
    return { success: true, data };
  }
}

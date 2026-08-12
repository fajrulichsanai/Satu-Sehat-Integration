import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingsService } from './billings.service';
import { PaymentsService } from '../payments/payments.service';
import { TarifsService } from './tarifs.service';
import {
  BillingQueryDto,
  CreateBillingDto,
  CreatePaymentDto,
  UpdateBillingDto,
} from './dto/billing.dto';
import { CreateTarifDto, TarifQueryDto, UpdateTarifDto } from './dto/tarif.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvoiceService } from './invoice.service';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('billing')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller()
export class BillingController {
  constructor(
    private readonly billingsService: BillingsService,
    private readonly paymentsService: PaymentsService,
    private readonly tarifsService: TarifsService,
    private readonly invoiceService: InvoiceService,
  ) {}

  // ── Tarifs ────────────────────────────────────────────────────────────────

  @Get('settings/tarifs')
  @ApiOperation({ summary: 'List tarifs (settings)' })
  async findTarifs(
    @ClinicId() clinicId: number,
    @Query() query: TarifQueryDto,
  ) {
    const result = await this.tarifsService.findAll(clinicId, query);
    return { success: true, data: result };
  }

  @Get('settings/tarifs/:id')
  @ApiOperation({ summary: 'Get tarif detail (settings)' })
  async findOneTarif(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.tarifsService.findOne(id, clinicId);
    return { success: true, data };
  }

  @Post('settings/tarifs')
  @Audit('Tarif', AuditActionType.CREATE, { labelField: 'name' })
  @ApiOperation({ summary: 'Create tarif' })
  async createTarif(
    @ClinicId() clinicId: number,
    @Body() dto: CreateTarifDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.tarifsService.create(clinicId, dto, user.userId);
    return { success: true, data };
  }

  @Put('settings/tarifs/:id')
  @Audit('Tarif', AuditActionType.UPDATE, { labelField: 'name' })
  @ApiOperation({ summary: 'Update tarif' })
  async updateTarif(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateTarifDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    req.auditBefore = await this.tarifsService.findOne(id, clinicId);
    const data = await this.tarifsService.update(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete('settings/tarifs/:id')
  @Audit('Tarif', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Delete (deactivate) tarif' })
  async deleteTarif(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const existing = await this.tarifsService.findOne(id, clinicId);
    req.auditBefore = existing;
    req.auditEntityLabel = existing?.name;
    await this.tarifsService.remove(id, clinicId, user.userId);
    return { success: true };
  }

  // ── Billings ──────────────────────────────────────────────────────────────

  @Get('billings')
  @ApiOperation({ summary: 'List billings' })
  async findBillings(
    @ClinicId() clinicId: number,
    @Query() query: BillingQueryDto,
  ) {
    const data = await this.billingsService.findAll(clinicId, query);
    return { success: true, data };
  }

  @Post('billings')
  @Audit('Invoice', AuditActionType.CREATE, { labelField: 'invoiceNumber' })
  @ApiOperation({ summary: 'Create billing for encounter' })
  async createBilling(
    @ClinicId() clinicId: number,
    @Body() dto: CreateBillingDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.billingsService.create(clinicId, dto, user.userId);
    return { success: true, data };
  }

  @Get('billings/:id')
  @ApiOperation({ summary: 'Get billing detail with items and payments' })
  async findOneBilling(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.billingsService.findOne(id, clinicId);
    return { success: true, data };
  }

  @Patch('billings/:id')
  @Audit('Invoice', AuditActionType.UPDATE, { labelField: 'invoiceNumber' })
  @ApiOperation({ summary: 'Update billing items, discount, fee, or notes' })
  async updateBilling(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateBillingDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    req.auditBefore = await this.billingsService.findOne(id, clinicId);
    const data = await this.billingsService.update(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  @Post('billings/:id/payments')
  @Audit('Payment', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Record payment for billing' })
  async createPayment(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.paymentsService.createPayment(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Get('billings/:id/invoice')
  @Audit('Invoice', AuditActionType.EXPORT)
  @ApiOperation({ summary: 'Download invoice as PDF' })
  async downloadInvoice(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.invoiceService.generateInvoicePdf(
      id,
      clinicId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${id}.pdf"`,
    );
    res.end(pdfBuffer);
  }
}

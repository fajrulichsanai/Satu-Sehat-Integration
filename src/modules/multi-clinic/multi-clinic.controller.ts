import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MultiClinicService } from './multi-clinic.service';
import {
  LinkClinicDto,
  MultiClinicDashboardQueryDto,
  MultiClinicReportQueryDto,
  SetBillingModeDto,
} from './dto/owner-clinic-link.dto';
import { ClinicsService } from '../clinics/clinics.service';
import { UpdateClinicDto } from '../clinics/dto/clinic.dto';
import { clinicLogoUploadOptions } from '../clinics/upload/clinic-logo.upload';
import { SubscriptionPaymentsService } from '../subscriptions/subscription-payments.service';
import {
  ClaimOwnerSubscriptionPaymentDto,
  QuoteQueryDto,
  SubscriptionPaymentQueryDto,
} from '../subscriptions/dto/subscription-payment.dto';
import { paymentProofUploadOptions } from '../subscriptions/upload/payment-proof.storage';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';

@ApiTags('multi-clinic')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('multi-clinic')
export class MultiClinicController {
  constructor(
    private readonly multiClinicService: MultiClinicService,
    private readonly clinicsService: ClinicsService,
    private readonly subscriptionPaymentsService: SubscriptionPaymentsService,
  ) {}

  @Get('my-clinics')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({ summary: 'Daftar klinik milik akun multi-klinik owner ini' })
  async myClinics(@CurrentUser() user: any) {
    const data = await this.multiClinicService.getMyClinics(user.userId);
    return { success: true, data };
  }

  @Get('dashboard')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary: 'Dashboard ringkasan gabungan lintas klinik milik owner ini',
  })
  async dashboard(
    @CurrentUser() user: any,
    @Query() query: MultiClinicDashboardQueryDto,
  ) {
    const data = await this.multiClinicService.getDashboard(
      user.userId,
      query.clinicId,
    );
    return { success: true, data };
  }

  @Get('reports')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary:
      'Laporan kunjungan & keuangan semua cabang, bisa difilter satu cabang',
  })
  async report(
    @CurrentUser() user: any,
    @Query() query: MultiClinicReportQueryDto,
  ) {
    const data = await this.multiClinicService.getReport(user.userId, query);
    return { success: true, data };
  }

  @Get('pending')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({ summary: 'Permintaan hubungan yang menunggu persetujuan' })
  async pending(@CurrentUser() user: any) {
    const data = await this.multiClinicService.getPendingForOwner(user.userId);
    return { success: true, data };
  }

  @Put('clinics/:clinicId/billing-mode')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary:
      'Atur cara bayar cabang (ditanggung owner / bayar sendiri / berhenti), berlaku periode berikutnya',
  })
  async setBillingMode(
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @Body() dto: SetBillingModeDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.multiClinicService.setBillingMode(
      user.userId,
      clinicId,
      dto.billingMode,
      user,
    );
    return { success: true, data };
  }

  @Get('owners')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Daftar akun multi-klinik owner beserta klinik miliknya (Super Admin)',
  })
  async owners() {
    const data = await this.multiClinicService.listOwners();
    return { success: true, data };
  }

  @Post('owners/:ownerId/clinics')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Ajukan hubungan klinik ke owner multiklinik (menunggu persetujuan owner klinik), atau hubungkan langsung untuk cabang baru (Super Admin)',
  })
  async linkClinic(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body() dto: LinkClinicDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.multiClinicService.requestLink(
      ownerId,
      dto.clinicId,
      user,
      { direct: dto.direct === true },
    );
    return { success: true, data };
  }

  @Delete('owners/:ownerId/clinics/:clinicId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Putuskan hubungan klinik dari akun multi-klinik owner (Super Admin)',
  })
  async unlinkClinic(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @CurrentUser() user: any,
  ) {
    await this.multiClinicService.unlinkClinic(ownerId, clinicId, user);
    return { success: true };
  }

  @Get('clinics/:clinicId')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary: 'Info salah satu klinik milik akun multi-klinik owner ini',
  })
  async getClinic(
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @CurrentUser() user: any,
  ) {
    await this.multiClinicService.assertOwnsClinic(user.userId, clinicId);
    return this.clinicsService.findOne(clinicId);
  }

  @Put('clinics/:clinicId')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary: 'Update info salah satu klinik milik akun multi-klinik owner ini',
  })
  async updateClinic(
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @Body() dto: UpdateClinicDto,
    @CurrentUser() user: any,
  ) {
    await this.multiClinicService.assertOwnsClinic(user.userId, clinicId);
    return this.clinicsService.update(clinicId, dto, user.userId);
  }

  @Post('clinics/:clinicId/logo')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary: 'Unggah logo salah satu klinik milik akun multi-klinik owner ini',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', clinicLogoUploadOptions))
  async uploadClinicLogo(
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    await this.multiClinicService.assertOwnsClinic(user.userId, clinicId);
    return this.clinicsService.uploadLogo(clinicId, file);
  }

  @Get('payments/quote')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary:
      'Rincian tagihan gabungan sebelum bayar (promo, diskon lama langganan, storage)',
  })
  async quotePayment(@Query() query: QuoteQueryDto, @CurrentUser() user: any) {
    const clinicIds = await this.multiClinicService.getOwnerBilledClinicIds(
      user.userId,
    );
    const { plan, quote } =
      await this.subscriptionPaymentsService.quoteForOwner(
        user.userId,
        clinicIds,
        query.planId,
        query.months ?? 1,
      );
    return {
      planId: plan.id,
      planName: plan.name,
      clinicCount: clinicIds.length,
      ...quote,
    };
  }

  @Post('payments/claim')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @UseInterceptors(FileInterceptor('proof', paymentProofUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Bayar sekali untuk semua klinik yang terhubung ke akun ini (Multi-Klinik Owner)',
  })
  async claimPayment(
    @Body() dto: ClaimOwnerSubscriptionPaymentDto,
    @CurrentUser() user: any,
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    // Hanya cabang yang ditanggung owner (bukan "bayar sendiri"/"berhenti").
    const clinicIds = await this.multiClinicService.getOwnerBilledClinicIds(
      user.userId,
    );
    return this.subscriptionPaymentsService.claimForOwner(
      user.userId,
      clinicIds,
      dto,
      user.userId,
      proof,
    );
  }

  @Get('payments/:id/proof-file')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary: 'Bukti transfer pembayaran gabungan milik akun ini',
  })
  async getProofFile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const path = await this.subscriptionPaymentsService.getOwnerProofFilePath(
      id,
      user.userId,
    );
    res.sendFile(path);
  }

  @Get('payments/mine')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary: 'Riwayat pembayaran akun multi-klinik owner ini',
  })
  listMyPayments(
    @CurrentUser() user: any,
    @Query() query: SubscriptionPaymentQueryDto,
  ) {
    return this.subscriptionPaymentsService.listMineForOwner(
      user.userId,
      query,
    );
  }
}

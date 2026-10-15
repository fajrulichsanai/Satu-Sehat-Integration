import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { RequireFeature } from '../features/require-feature.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';
import { PayrollService } from './payroll.service';
import { PayrollPdfService } from './payroll-pdf.service';
import {
  PayPayrollDto,
  UpdatePayrollItemDto,
  UpsertSalaryDto,
} from './dto/payroll.dto';

/** Payroll — owner saja: data gaji bersifat rahasia. */
@ApiTags('payroll')
@RequireFeature('payroll')
@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Roles(UserRole.OWNER)
@ApiBearerAuth('JWT-auth')
export class PayrollController {
  constructor(
    private readonly service: PayrollService,
    private readonly pdf: PayrollPdfService,
  ) {}

  @Get('employees')
  @ApiOperation({ summary: 'Daftar pegawai + gaji pokok & rekening' })
  employees(@ClinicId() clinicId: number) {
    return this.service.listEmployees(clinicId);
  }

  @Put('employees/:userId')
  @Audit('EmployeeSalary', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Atur gaji pokok & rekening pegawai' })
  upsertSalary(
    @ClinicId() clinicId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpsertSalaryDto,
  ) {
    return this.service.upsertSalary(clinicId, userId, dto);
  }

  @Get('runs')
  @ApiOperation({ summary: 'Riwayat payroll per periode' })
  runs(@ClinicId() clinicId: number) {
    return this.service.listRuns(clinicId);
  }

  @Get('runs/:period')
  @ApiOperation({
    summary: 'Detail payroll periode (pratinjau bila belum dibuat)',
  })
  run(@ClinicId() clinicId: number, @Param('period') period: string) {
    return this.service.getRun(clinicId, period);
  }

  @Post('runs/:period/generate')
  @Audit('PayrollRun', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Buat / hitung ulang draft payroll' })
  generate(
    @ClinicId() clinicId: number,
    @Param('period') period: string,
    @CurrentUser() user: { userId: number },
  ) {
    return this.service.generate(clinicId, period, user.userId);
  }

  @Patch('runs/:period/items/:id')
  @Audit('PayrollItem', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Ubah bonus / potongan / catatan' })
  updateItem(
    @ClinicId() clinicId: number,
    @Param('period') period: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayrollItemDto,
  ) {
    return this.service.updateItem(clinicId, period, id, dto);
  }

  @Post('runs/:period/pay')
  @Audit('PayrollRun', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Tandai dibayar & catat pengeluaran gaji' })
  pay(
    @ClinicId() clinicId: number,
    @Param('period') period: string,
    @CurrentUser() user: { userId: number },
    @Body() dto: PayPayrollDto,
  ) {
    return this.service.markPaid(clinicId, period, user.userId, dto);
  }

  @Post('runs/:period/reopen')
  @Audit('PayrollRun', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Batalkan status dibayar' })
  reopen(@ClinicId() clinicId: number, @Param('period') period: string) {
    return this.service.reopen(clinicId, period);
  }

  @Get('runs/:period/recap.pdf')
  @ApiOperation({ summary: 'PDF rekap transfer gaji' })
  async recapPdf(
    @ClinicId() clinicId: number,
    @Param('period') period: string,
    @Res() res: Response,
  ) {
    const buf = await this.pdf.recap(clinicId, period);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rekap-gaji-${period}.pdf"`,
    );
    res.end(buf);
  }

  @Get('runs/:period/slip/:userId.pdf')
  @ApiOperation({ summary: 'PDF slip gaji pegawai' })
  async slipPdf(
    @ClinicId() clinicId: number,
    @Param('period') period: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Res() res: Response,
  ) {
    const buf = await this.pdf.slip(clinicId, period, userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="slip-gaji-${period}-${userId}.pdf"`,
    );
    res.end(buf);
  }
}

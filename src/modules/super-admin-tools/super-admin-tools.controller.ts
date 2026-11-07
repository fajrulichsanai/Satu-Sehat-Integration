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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';
import { SkipSubscriptionCheck } from '../subscriptions/guards/subscription.guard';
import { SuperAdminToolsService } from './super-admin-tools.service';

class PicDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}

class NoteDto {
  @IsString()
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsDateString()
  followUpOn?: string | null;
}

class NoteDoneDto {
  @IsBoolean()
  done: boolean;
}

class PaymentsCsvQuery {
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'rejected'])
  status?: string;
}

class AuditCsvQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clinicId?: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

function sendCsv(res: Response, name: string, csv: string) {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${name}-${date}.csv"`,
  );
  res.send(csv);
}

@ApiTags('super-admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@SkipSubscriptionCheck()
@Controller('super-admin')
export class SuperAdminToolsController {
  constructor(private readonly tools: SuperAdminToolsService) {}

  @Get('clinics/:id/notes')
  @ApiOperation({
    summary: 'Catatan internal klinik: PIC, WhatsApp, tindak lanjut',
  })
  notes(@Param('id', ParseIntPipe) id: number) {
    return this.tools.notes(id);
  }

  @Put('clinics/:id/pic')
  @ApiOperation({ summary: 'Ubah kontak PIC klinik' })
  setPic(@Param('id', ParseIntPipe) id: number, @Body() dto: PicDto) {
    return this.tools.setPic(id, dto.name ?? null, dto.phone ?? null);
  }

  @Post('clinics/:id/notes')
  @ApiOperation({
    summary: 'Tambah catatan internal (opsional tanggal tindak lanjut)',
  })
  addNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NoteDto,
    @CurrentUser() user: any,
  ) {
    return this.tools.addNote(id, dto.body, dto.followUpOn ?? null, {
      id: user.userId,
      name: user.name ?? user.email ?? 'Super Admin',
    });
  }

  @Patch('clinics/:id/notes/:noteId')
  @ApiOperation({ summary: 'Tandai tindak lanjut selesai / belum' })
  setDone(
    @Param('id', ParseIntPipe) id: number,
    @Param('noteId', ParseIntPipe) noteId: number,
    @Body() dto: NoteDoneDto,
  ) {
    return this.tools.setNoteDone(id, noteId, dto.done);
  }

  @Delete('clinics/:id/notes/:noteId')
  @ApiOperation({ summary: 'Hapus catatan internal' })
  deleteNote(
    @Param('id', ParseIntPipe) id: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.tools.deleteNote(id, noteId);
  }

  @Get('export/clinics.csv')
  @ApiOperation({ summary: 'Ekspor CSV daftar klinik' })
  async clinicsCsv(@Res() res: Response) {
    sendCsv(res, 'klinik', await this.tools.clinicsCsv());
  }

  @Get('export/payments.csv')
  @ApiOperation({ summary: 'Ekspor CSV pembayaran langganan' })
  async paymentsCsv(@Query() q: PaymentsCsvQuery, @Res() res: Response) {
    sendCsv(res, 'pembayaran', await this.tools.paymentsCsv(q.status));
  }

  @Get('export/audit-log.csv')
  @ApiOperation({ summary: 'Ekspor CSV log aktivitas (maks. 10.000 baris)' })
  async auditCsv(@Query() q: AuditCsvQuery, @Res() res: Response) {
    sendCsv(res, 'log-aktivitas', await this.tools.auditCsv(q));
  }
}

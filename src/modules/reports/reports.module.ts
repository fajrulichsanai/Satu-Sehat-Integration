import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { Billing } from '../billing/entities/billing.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SatusehatSyncLog } from '../satusehat/sync/entities/satusehat-sync-log.entity';
import { BillingItem } from '../billing-item/entities/billing-item.entity';
import { DoctorFeeConfig } from '../doctor-fee/entities/doctor-fee-config.entity';
import { OperationalRecord } from '../operational-records/entities/operational-record.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Barang } from '../gudang/entities/barang.entity';
import { StokTransaksi } from '../gudang/entities/stok-transaksi.entity';
import { Patient } from '../patients/entities/patient.entity';
import { PatientOriginGeocode } from './entities/patient-origin-geocode.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { InvestorReportPdfService } from './investor-report-pdf.service';
import { FinancialReportPdfService } from './financial-report-pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter,
      Billing,
      Payment,
      SatusehatSyncLog,
      BillingItem,
      DoctorFeeConfig,
      OperationalRecord,
      Clinic,
      Barang,
      StokTransaksi,
      Patient,
      PatientOriginGeocode,
    ]),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    InvestorReportPdfService,
    FinancialReportPdfService,
  ],
})
export class ReportsModule {}

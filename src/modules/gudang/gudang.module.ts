import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barang } from './entities/barang.entity';
import { StokTransaksi } from './entities/stok-transaksi.entity';
import { TindakanBom } from './entities/tindakan-bom.entity';
import { GudangController } from './gudang.controller';
import { GudangService } from './gudang.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Barang, StokTransaksi, TindakanBom]),
    AuditLogModule,
  ],
  controllers: [GudangController],
  providers: [GudangService],
  exports: [GudangService],
})
export class GudangModule {}

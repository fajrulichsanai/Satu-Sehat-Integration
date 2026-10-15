import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barang } from './entities/barang.entity';
import { StokTransaksi } from './entities/stok-transaksi.entity';
import { TindakanBom } from './entities/tindakan-bom.entity';
import { GudangController } from './gudang.controller';
import { GudangService } from './gudang.service';
import { StockOpnameService } from './stock-opname.service';
import { StockOpname, StockOpnameItem } from './entities/stock-opname.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Barang,
      StokTransaksi,
      TindakanBom,
      StockOpname,
      StockOpnameItem,
      User,
    ]),
    AuditLogModule,
  ],
  controllers: [GudangController],
  providers: [GudangService, StockOpnameService],
  exports: [GudangService],
})
export class GudangModule {}

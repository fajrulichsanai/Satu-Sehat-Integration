import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SatusehatModule } from '../satusehat/satusehat.module';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';

@Module({
  imports: [ConfigModule, SatusehatModule],
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}

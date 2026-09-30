import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicContent } from './entities/clinic-content.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ContentsService } from './contents.service';
import { ContentsController } from './contents.controller';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicContent, Clinic]), StorageModule],
  controllers: [ContentsController],
  providers: [ContentsService],
  exports: [ContentsService],
})
export class ContentsModule {}

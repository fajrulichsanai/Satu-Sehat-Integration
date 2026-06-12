import { Module } from '@nestjs/common';
import { IcdController } from './icd.controller';
import { IcdService } from './icd.service';

@Module({
  controllers: [IcdController],
  providers: [IcdService],
  exports: [IcdService],
})
export class IcdModule {}

import { Module } from '@nestjs/common';
import { SuperAdminToolsService } from './super-admin-tools.service';
import { SuperAdminToolsController } from './super-admin-tools.controller';

@Module({
  controllers: [SuperAdminToolsController],
  providers: [SuperAdminToolsService],
  exports: [SuperAdminToolsService],
})
export class SuperAdminToolsModule {}

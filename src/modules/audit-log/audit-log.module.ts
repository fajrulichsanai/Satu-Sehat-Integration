import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { BranchAuditInterceptor } from './interceptors/branch-audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditInterceptor, BranchAuditInterceptor],
  exports: [AuditLogService, AuditInterceptor, BranchAuditInterceptor],
})
export class AuditLogModule {}

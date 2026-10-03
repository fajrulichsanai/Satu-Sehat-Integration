import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SoapTemplate } from './entities/soap-template.entity';
import { SoapTemplatesController } from './soap-templates.controller';
import { SoapTemplatesService } from './soap-templates.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([SoapTemplate]), AuditLogModule],
  controllers: [SoapTemplatesController],
  providers: [SoapTemplatesService],
})
export class SoapTemplatesModule {}

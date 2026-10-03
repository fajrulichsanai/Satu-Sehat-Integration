import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataRequest } from './entities/data-request.entity';
import { DataRequestsService } from './data-requests.service';
import { DataRequestsController } from './data-requests.controller';
import { User } from '../users/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataRequest, User, Clinic]),
    AuditLogModule,
  ],
  controllers: [DataRequestsController],
  providers: [DataRequestsService],
})
export class DataRequestsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToothCondition } from './entities/tooth-condition.entity';
import { DentalBridge } from './entities/dental-bridge.entity';
import { Patient } from '../patients/entities/patient.entity';
import { OdontogramController } from './odontogram.controller';
import { OdontogramService } from './odontogram.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ToothCondition, DentalBridge, Patient]),
    AuditLogModule,
  ],
  controllers: [OdontogramController],
  providers: [OdontogramService],
})
export class OdontogramModule {}

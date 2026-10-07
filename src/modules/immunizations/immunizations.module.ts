import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SatusehatResourceLink } from '../satusehat/sync/entities/satusehat-resource-link.entity';
import { Immunization } from './entities/immunization.entity';
import { ImmunizationsController } from './immunizations.controller';
import { ImmunizationsService } from './immunizations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Immunization, Encounter, SatusehatResourceLink]),
    AuditLogModule,
  ],
  controllers: [ImmunizationsController],
  providers: [ImmunizationsService],
})
export class ImmunizationsModule {}

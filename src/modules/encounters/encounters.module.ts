import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from './entities/encounter.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter, Reservation]), AuditLogModule],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}

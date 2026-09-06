import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncounterSoapNote } from './entities/encounter-soap-note.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { EncounterSoapNotesController } from './encounter-soap-notes.controller';
import { EncounterSoapNotesService } from './encounter-soap-notes.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EncounterSoapNote, Encounter]),
    AuditLogModule,
  ],
  controllers: [EncounterSoapNotesController],
  providers: [EncounterSoapNotesService],
})
export class EncounterSoapNotesModule {}

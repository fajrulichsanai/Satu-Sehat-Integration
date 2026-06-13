import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './entities/patient.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { SatusehatModule } from '../satusehat/satusehat.module';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Encounter]), SatusehatModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}

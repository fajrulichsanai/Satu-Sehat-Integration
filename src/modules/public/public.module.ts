import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Queue } from '../queues/entities/queue.entity';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { QueuesModule } from '../queues/queues.module';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clinic, Patient, Queue]),
    QueuesModule,
    PatientsModule,
  ],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}

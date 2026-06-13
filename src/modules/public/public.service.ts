import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Queue } from '../queues/entities/queue.entity';
import { Gender, QueueStatus } from '../../enums';
import {
  AvailableSlotsQueryDto,
  BookingDto,
  QueueStatusQueryDto,
} from './dto/public.dto';
import { QueuesService } from '../queues/queues.service';
import { PatientsService } from '../patients/patients.service';
import { startOfDay, endOfDay } from '../../common/utils/date.util';

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Queue)
    private readonly queueRepository: Repository<Queue>,
    private readonly queuesService: QueuesService,
    private readonly patientsService: PatientsService,
  ) {}

  async getClinicInfo(clinicId: number) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId, setupComplete: true },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        province: true,
        phone: true,
        email: true,
        operationalHours: true,
      },
    });
    if (!clinic) {
      throw new NotFoundException('Klinik tidak ditemukan atau belum aktif');
    }
    return clinic;
  }

  async getAvailableSlots(query: AvailableSlotsQueryDto) {
    return this.queuesService.getAvailableSlots(query.clinicId, {
      date: query.date,
      locationId: query.locationId,
      practitionerId: query.practitionerId,
    });
  }

  async book(dto: BookingDto) {
    let patient = await this.patientRepository.findOne({
      where: { nik: dto.patientNik, clinicId: dto.clinicId },
    });

    if (!patient) {
      patient = await this.patientsService.create(dto.clinicId, {
        name: dto.patientName,
        nik: dto.patientNik,
        phone: dto.patientPhone,
        gender: Gender.MALE, // default; frontend should correct later
      });
    }

    const queue = await this.queuesService.create(dto.clinicId, {
      patientId: patient.id,
      patientName: patient.name,
      phone: dto.patientPhone,
      practitionerId: dto.practitionerId || 0,
      appointmentDate: dto.appointmentDate,
      jamSlot: dto.jamSlot,
      serviceType: dto.serviceType,
      locationId: dto.locationId,
      isFirstVisit: false,
    });

    return {
      bookingToken: queue.token,
      queueNumber: queue.nomorAntrian,
      patientName: patient.name,
      appointmentDate: dto.appointmentDate,
      jamSlot: dto.jamSlot,
    };
  }

  async getQueueStatus(query: QueueStatusQueryDto) {
    const queue = await this.queueRepository.findOne({
      where: { token: query.token },
      select: {
        id: true,
        nomorAntrian: true,
        status: true,
        tanggal: true,
        jamSlot: true,
        patientName: true,
      },
    });
    if (!queue) {
      throw new NotFoundException('Token antrian tidak ditemukan');
    }

    const waitingAhead = await this.queueRepository.count({
      where: {
        clinicId: (queue as any).clinicId,
        status: QueueStatus.WAITING,
      },
    });

    return {
      queueNumber: queue.nomorAntrian,
      status: queue.status,
      date: queue.tanggal,
      jamSlot: queue.jamSlot,
      patientName: queue.patientName,
      estimatedWaitMinutes: waitingAhead * 15,
    };
  }
}

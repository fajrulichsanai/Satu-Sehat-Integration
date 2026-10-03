import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Tarif } from '../tarif/entities/tarif.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(Tarif)
    private readonly tarifRepo: Repository<Tarif>,
    @InjectRepository(Practitioner)
    private readonly practitionerRepo: Repository<Practitioner>,
  ) {}

  async getStatus(clinicId: number) {
    const [clinic, tarifCount, dokterCount] = await Promise.all([
      this.clinicRepo.findOne({ where: { id: clinicId } }),
      this.tarifRepo.count({ where: { clinicId, isActive: true } }),
      this.practitionerRepo.count({ where: { clinicId, isActive: true } }),
    ]);

    const infoKlinik = { complete: !!clinic?.setupComplete };
    const tarif = { complete: tarifCount > 0, count: tarifCount };
    const dokter = { complete: dokterCount > 0, count: dokterCount };

    return {
      success: true,
      data: {
        infoKlinik,
        tarif,
        dokter,
        allComplete: infoKlinik.complete && tarif.complete && dokter.complete,
      },
    };
  }
}

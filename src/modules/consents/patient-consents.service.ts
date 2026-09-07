import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PatientConsent,
  PatientConsentStatus,
} from './entities/patient-consent.entity';
import { ConsentTemplate } from './entities/consent-template.entity';
import { Patient } from '../patients/entities/patient.entity';
import { ConsentTemplatesService } from './consent-templates.service';
import {
  ConsentSignerRole,
  CreatePatientConsentDto,
  PatientConsentQueryDto,
  SignPatientConsentDto,
} from './dto/patient-consent.dto';

@Injectable()
export class PatientConsentsService {
  constructor(
    @InjectRepository(PatientConsent)
    private readonly consentRepository: Repository<PatientConsent>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly consentTemplatesService: ConsentTemplatesService,
  ) {}

  async findAll(clinicId: number, query: PatientConsentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.consentRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.patient', 'patient')
      .leftJoinAndSelect('c.tarif', 'tarif')
      .where('c.clinicId = :clinicId', { clinicId });

    if (query.patientId) {
      qb.andWhere('c.patientId = :patientId', { patientId: query.patientId });
    }
    if (query.encounterId) {
      qb.andWhere('c.encounterId = :encounterId', {
        encounterId: query.encounterId,
      });
    }
    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    const [data, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number, clinicId: number) {
    const consent = await this.consentRepository.findOne({
      where: { id, clinicId },
      relations: { patient: true, tarif: true, encounter: true },
    });
    if (!consent) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PATIENT_CONSENT_NOT_FOUND',
          message: 'Formulir persetujuan tidak ditemukan',
        },
      });
    }
    return consent;
  }

  async create(clinicId: number, dto: CreatePatientConsentDto, userId: number) {
    const patient = await this.patientRepository.findOne({
      where: { id: dto.patientId, clinicId },
    });
    if (!patient) {
      throw new NotFoundException({
        success: false,
        error: { code: 'PATIENT_NOT_FOUND', message: 'Pasien tidak ditemukan' },
      });
    }

    let template: ConsentTemplate | null = null;
    if (dto.templateId) {
      template = await this.consentTemplatesService
        .findAll(clinicId)
        .then((all) => all.find((t) => t.id === dto.templateId) ?? null);
    } else if (dto.tarifId) {
      template = await this.consentTemplatesService.findByTarif(
        clinicId,
        dto.tarifId,
      );
    }
    if (!template) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'CONSENT_TEMPLATE_REQUIRED',
          message:
            'Template persetujuan belum diatur untuk tindakan ini. Hubungi Owner klinik untuk mengaturnya di menu Konfigurasi Consent.',
        },
      });
    }

    const created = this.consentRepository.create({
      clinicId,
      patientId: dto.patientId,
      encounterId: dto.encounterId ?? null,
      tarifId: dto.tarifId ?? template.tarifId ?? null,
      templateId: template.id,
      title: template.title,
      content: template.content,
      status: PatientConsentStatus.DRAFT,
      createdBy: userId,
    });
    return this.consentRepository.save(created);
  }

  async sign(
    id: number,
    clinicId: number,
    dto: SignPatientConsentDto,
    userId: number,
  ) {
    const consent = await this.findOne(id, clinicId);

    if (dto.role === ConsentSignerRole.PATIENT) {
      consent.patientSignature = dto.signatureDataUrl;
      consent.patientSignerName = dto.signerName || consent.patient.name;
      consent.patientSignedAt = new Date();
    } else {
      consent.doctorSignature = dto.signatureDataUrl;
      consent.doctorSignedBy = userId;
      consent.doctorSignedAt = new Date();
    }

    consent.status =
      consent.patientSignature && consent.doctorSignature
        ? PatientConsentStatus.COMPLETED
        : PatientConsentStatus.PARTIAL;
    consent.updatedBy = userId;

    return this.consentRepository.save(consent);
  }
}

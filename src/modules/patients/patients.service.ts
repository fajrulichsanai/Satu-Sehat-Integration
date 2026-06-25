import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import {
  CreatePatientDto,
  PatientQueryDto,
  UpdatePatientDto,
} from './dto/patient.dto';
import { paginate, PaginatedResult } from '../../common/dto/pagination.dto';
import { SatusehatClientService } from '../satusehat/satusehat-client.service';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    private readonly dataSource: DataSource,
    private readonly satusehatClient: SatusehatClientService,
  ) {}

  async findAll(
    clinicId: number,
    query: PatientQueryDto,
  ): Promise<PaginatedResult<Patient>> {
    this.logger.log(`[GET-ALL] Mengambil daftar pasien | clinicId=${clinicId}, search=${query.search || '-'}`);
    const qb = this.patientRepository
      .createQueryBuilder('p')
      .where('p.clinicId = :clinicId', { clinicId });

    if (query.search) {
      qb.andWhere(
        '(p.name LIKE :search OR p.noRm LIKE :search OR p.nik = :nik)',
        { search: `%${query.search}%`, nik: query.search },
      );
    }

    if (query.gender) {
      qb.andWhere('p.gender = :gender', { gender: query.gender });
    }

    const sortBy = query.sortBy || 'p.createdAt';
    const validSortColumns = ['p.name', 'p.noRm', 'p.createdAt', 'p.updatedAt'];
    const finalSort = validSortColumns.includes(sortBy)
      ? sortBy
      : 'p.createdAt';
    qb.orderBy(finalSort, query.sortOrder);

    return paginate(qb, query);
  }

  async findOne(id: number, clinicId: number): Promise<Patient> {
    this.logger.log(`[GET] Mengambil data pasien | id=${id}, clinicId=${clinicId}`);
    const patient = await this.patientRepository.findOne({
      where: { id, clinicId },
    });
    if (!patient) {
      this.logger.warn(`[GET] Pasien tidak ditemukan | id=${id}, clinicId=${clinicId}`);
      throw new NotFoundException(`Pasien dengan ID ${id} tidak ditemukan`);
    }
    return patient;
  }

  async findEncounters(patientId: number, clinicId: number) {
    await this.findOne(patientId, clinicId);
    return this.encounterRepository.find({
      where: { patientId, clinicId },
      select: {
        id: true,
        status: true,
        serviceType: true,
        arrivedTime: true,
        finishedTime: true,
      },
      order: { arrivedTime: 'DESC' },
    });
  }

  async create(clinicId: number, dto: CreatePatientDto): Promise<Patient> {
    this.logger.log(`[CREATE] Membuat pasien baru | clinicId=${clinicId}, name=${dto.name}, nik=${dto.nik || 'bayi'}`);
    if (!dto.isNewborn && !dto.nik) {
      this.logger.warn(`[CREATE] NIK tidak diisi untuk pasien bukan bayi | clinicId=${clinicId}`);
      throw new BadRequestException(
        'NIK wajib diisi untuk pasien bukan bayi baru lahir',
      );
    }

    if (dto.nik) {
      await this.checkDuplicateNik(dto.nik, clinicId);
    }

    const noRm = await this.generateNoRm(clinicId);

    const patient = this.patientRepository.create({
      clinicId,
      noRm,
      nik: dto.nik,
      nikIbu: dto.nikIbu,
      name: dto.name,
      birthDate: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      gender: dto.gender,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
      city: dto.city,
      province: dto.province,
      postalCode: dto.postalCode,
      maritalStatus: dto.maritalStatus,
    });

    const saved = await this.patientRepository.save(patient);
    this.logger.log(`[CREATE] Pasien berhasil dibuat | id=${saved.id}, noRm=${saved.noRm}, clinicId=${clinicId}`);
    return saved;
  }

  async update(
    id: number,
    clinicId: number,
    dto: UpdatePatientDto,
  ): Promise<Patient> {
    this.logger.log(`[UPDATE] Memperbarui data pasien | id=${id}, clinicId=${clinicId}`);
    const patient = await this.findOne(id, clinicId);

    if (dto.nik && dto.nik !== patient.nik) {
      await this.checkDuplicateNik(dto.nik, clinicId, id);
    }

    Object.assign(patient, {
      nik: dto.nik ?? patient.nik,
      nikIbu: dto.nikIbu ?? patient.nikIbu,
      name: dto.name ?? patient.name,
      birthDate: dto.dateOfBirth
        ? new Date(dto.dateOfBirth)
        : patient.birthDate,
      gender: dto.gender ?? patient.gender,
      phone: dto.phone ?? patient.phone,
      email: dto.email ?? patient.email,
      address: dto.address ?? patient.address,
      city: dto.city ?? patient.city,
      province: dto.province ?? patient.province,
      postalCode: dto.postalCode ?? patient.postalCode,
      maritalStatus: dto.maritalStatus ?? patient.maritalStatus,
    });

    const updated = await this.patientRepository.save(patient);
    this.logger.log(`[UPDATE] Data pasien berhasil diperbarui | id=${id}, clinicId=${clinicId}`);
    return updated;
  }

  private async checkDuplicateNik(
    nik: string,
    clinicId: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.patientRepository
      .createQueryBuilder('p')
      .where('p.nik = :nik AND p.clinicId = :clinicId', { nik, clinicId });

    if (excludeId) {
      qb.andWhere('p.id != :excludeId', { excludeId });
    }

    const existing = await qb.getOne();
    if (existing) {
      this.logger.warn(`[CREATE] NIK duplikat ditemukan | nik=${nik}, clinicId=${clinicId}`);
      throw new ConflictException(
        `Pasien dengan NIK ${nik} sudah terdaftar di klinik ini`,
      );
    }
  }

  async remove(id: number, clinicId: number): Promise<void> {
    this.logger.log(`[DELETE] Menghapus pasien | id=${id}, clinicId=${clinicId}`);
    const patient = await this.findOne(id, clinicId);

    const [{ total: encounterCount }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM encounters WHERE patient_id = ?`,
      [id],
    );
    const [{ total: billingCount }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM billings WHERE patient_id = ?`,
      [id],
    );

    if (parseInt(encounterCount, 10) > 0 || parseInt(billingCount, 10) > 0) {
      this.logger.warn(`[DELETE] Pasien memiliki riwayat kunjungan/billing | id=${id}`);
      throw new ConflictException(
        'Pasien tidak dapat dihapus karena memiliki riwayat kunjungan atau transaksi. Hapus atau pindahkan data terkait terlebih dahulu.',
      );
    }

    try {
      await this.patientRepository.remove(patient);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        throw new ConflictException(
          'Pasien tidak dapat dihapus karena masih memiliki data terkait.',
        );
      }
      throw err;
    }
    this.logger.log(`[DELETE] Pasien berhasil dihapus | id=${id}, clinicId=${clinicId}`);
  }

  async searchSatusehat(nik: string, clinicId: number) {
    this.logger.log(`[SEARCH] Mencari pasien di SATUSEHAT | nik=${nik}, clinicId=${clinicId}`);
    if (!nik) {
      this.logger.warn(`[SEARCH] NIK kosong untuk pencarian SATUSEHAT | clinicId=${clinicId}`);
      throw new BadRequestException('NIK diperlukan untuk pencarian SATUSEHAT');
    }
    return this.satusehatClient.searchPatientByNik(clinicId, nik);
  }

  private async generateNoRm(clinicId: number): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager.query(
        `SELECT COUNT(*) AS total FROM patients WHERE clinic_id = ?`,
        [clinicId],
      );
      const sequence = parseInt(result[0].total, 10) + 1;
      const clinicPad = String(clinicId).padStart(3, '0');
      const seqPad = String(sequence).padStart(6, '0');
      return `RM-${clinicPad}-${seqPad}`;
    });
  }
}

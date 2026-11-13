import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PhotoTemplateGroup } from './entities/photo-template-group.entity';
import { PhotoTemplate } from './entities/photo-template.entity';
import { PatientPhoto } from './entities/patient-photo.entity';
import { ClinicDisabledPhotoGroup } from './entities/clinic-disabled-photo-group.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import {
  CreatePhotoTemplateDto,
  CreatePhotoTemplateGroupDto,
  UpdatePhotoTemplateDto,
  UpdatePhotoTemplateGroupDto,
} from './dto/photo-template-group.dto';
import { patientPhotoFileToUrl } from './upload/patient-photo.storage';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import { StorageKind } from '../storage-quota/storage-usage.entity';

function toApiUrl(photo: PatientPhoto): PatientPhoto {
  if (!photo.fileUrl) return photo;
  return {
    ...photo,
    fileUrl: photo.encounterId
      ? `/encounters/${photo.encounterId}/photos/${photo.id}/file`
      : `/patients/${photo.patientId}/photos/${photo.id}/file`,
  } as PatientPhoto;
}

@Injectable()
export class ClinicalPhotosService {
  constructor(
    @InjectRepository(PhotoTemplateGroup)
    private readonly groupRepo: Repository<PhotoTemplateGroup>,
    @InjectRepository(PhotoTemplate)
    private readonly templateRepo: Repository<PhotoTemplate>,
    @InjectRepository(PatientPhoto)
    private readonly photoRepo: Repository<PatientPhoto>,
    @InjectRepository(ClinicDisabledPhotoGroup)
    private readonly disabledRepo: Repository<ClinicDisabledPhotoGroup>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @Optional() private readonly storageQuota?: StorageQuotaService,
  ) {}

  // ---------- Folder & template (Pengaturan) ----------

  /** Semua folder yang berlaku untuk klinik ini: bawaan sistem + miliknya. */
  async listGroups(
    clinicId: number,
    options: { activeOnly: boolean },
  ): Promise<PhotoTemplateGroup[]> {
    const groups = await this.groupRepo.find({
      where: [{ clinicId: IsNull() }, { clinicId }],
      relations: { templates: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const disabledIds = new Set(
      (
        await this.disabledRepo.find({ where: { clinicId } })
      ).map((d) => d.groupId),
    );
    const visible = groups
      .filter((g) => !(g.clinicId === null && disabledIds.has(g.id)))
      .map((g) => ({
        ...g,
        isActive: g.clinicId === null ? !disabledIds.has(g.id) : g.isActive,
        templates: [...g.templates].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
        ),
      }));
    const filtered = options.activeOnly
      ? visible
          .filter((g) => g.isActive)
          .map((g) => ({
            ...g,
            templates: g.templates.filter((t) => t.isActive),
          }))
      : visible;
    return filtered as PhotoTemplateGroup[];
  }

  async createGroup(
    clinicId: number,
    userId: number,
    dto: CreatePhotoTemplateGroupDto,
  ): Promise<PhotoTemplateGroup> {
    const group = this.groupRepo.create({
      clinicId,
      name: dto.name.trim(),
      sortOrder: 0,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.groupRepo.save(group);
  }

  /**
   * Folder bawaan sistem (clinicId null) tidak bisa diganti nama/urutan dari
   * sini — hanya boleh dinonaktifkan per klinik. Folder milik klinik sendiri
   * boleh diubah bebas.
   */
  async updateGroup(
    clinicId: number,
    userId: number,
    groupId: number,
    dto: UpdatePhotoTemplateGroupDto,
  ): Promise<PhotoTemplateGroup> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group || (group.clinicId !== null && group.clinicId !== clinicId)) {
      throw new NotFoundException('Folder tidak ditemukan');
    }
    if (group.clinicId === null) {
      if (dto.isActive === undefined) {
        throw new ForbiddenException(
          'Folder bawaan sistem hanya bisa dinonaktifkan, tidak diubah nama/urutannya',
        );
      }
      if (dto.isActive) {
        await this.disabledRepo.delete({ clinicId, groupId });
      } else {
        await this.disabledRepo.save({ clinicId, groupId });
      }
      return { ...group, isActive: dto.isActive } as PhotoTemplateGroup;
    }
    if (dto.name !== undefined) group.name = dto.name.trim();
    if (dto.sortOrder !== undefined) group.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) group.isActive = dto.isActive;
    group.updatedBy = userId;
    return this.groupRepo.save(group);
  }

  async createTemplate(
    clinicId: number,
    userId: number,
    groupId: number,
    dto: CreatePhotoTemplateDto,
  ): Promise<PhotoTemplate> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group || group.clinicId !== clinicId) {
      throw new NotFoundException(
        'Folder tidak ditemukan, atau bukan folder buatan klinik ini',
      );
    }
    const template = this.templateRepo.create({
      groupId,
      name: dto.name.trim(),
      sortOrder: dto.sortOrder ?? 0,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.templateRepo.save(template);
  }

  async updateTemplate(
    clinicId: number,
    userId: number,
    templateId: number,
    dto: UpdatePhotoTemplateDto,
  ): Promise<PhotoTemplate> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
      relations: { group: true },
    });
    if (!template) throw new NotFoundException('Slot tidak ditemukan');
    if (template.group.clinicId === null) {
      // Slot bawaan sistem: hanya boleh dinonaktifkan (per slot, global —
      // sama seperti folder bawaan, dampaknya untuk semua klinik yang
      // memakai slot ini dianggap cukup kecil karena hanya isActive).
      if (
        dto.name !== undefined ||
        dto.sortOrder !== undefined ||
        dto.isActive === undefined
      ) {
        throw new ForbiddenException(
          'Slot bawaan sistem hanya bisa dinonaktifkan dari sini',
        );
      }
    } else if (template.group.clinicId !== clinicId) {
      throw new NotFoundException('Slot tidak ditemukan');
    }
    if (dto.name !== undefined) template.name = dto.name.trim();
    if (dto.sortOrder !== undefined) template.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) template.isActive = dto.isActive;
    template.updatedBy = userId;
    return this.templateRepo.save(template);
  }

  // ---------- Foto pasien ----------

  /** Galeri satu pasien, tersusun per folder (hanya yang pernah dipakai). */
  async listForPatient(patientId: number, clinicId: number) {
    const patient = await this.assertPatient(patientId, clinicId);
    const photos = await this.photoRepo.find({
      where: { patientId },
      relations: { template: { group: true } },
      order: { takenAt: 'DESC', id: 'DESC' },
    });
    const byGroup = new Map<
      number | null,
      { group: PhotoTemplateGroup | null; photos: PatientPhoto[] }
    >();
    for (const photo of photos) {
      const group = photo.template?.group ?? null;
      const key = group?.id ?? null;
      if (!byGroup.has(key)) byGroup.set(key, { group, photos: [] });
      byGroup.get(key)!.photos.push(toApiUrl(photo));
    }
    return {
      consentMarketing: patient.photoConsentMarketing,
      folders: Array.from(byGroup.values()),
    };
  }

  async upload(
    encounterId: number,
    clinicId: number,
    userId: number,
    templateId: number | undefined,
    originalSizeBytes: number | undefined,
    file: Express.Multer.File | undefined,
  ): Promise<PatientPhoto> {
    const encounter = await this.assertEncounter(encounterId, clinicId);
    return this.store(
      encounter.patientId,
      encounterId,
      clinicId,
      userId,
      templateId,
      originalSizeBytes,
      file,
    );
  }

  /** Unggah langsung ke pasien — tidak perlu ada kunjungan. */
  async uploadForPatient(
    patientId: number,
    clinicId: number,
    userId: number,
    templateId: number | undefined,
    originalSizeBytes: number | undefined,
    file: Express.Multer.File | undefined,
  ): Promise<PatientPhoto> {
    await this.assertPatient(patientId, clinicId);
    return this.store(
      patientId,
      null,
      clinicId,
      userId,
      templateId,
      originalSizeBytes,
      file,
    );
  }

  private async store(
    patientId: number,
    encounterId: number | null,
    clinicId: number,
    userId: number,
    templateId: number | undefined,
    originalSizeBytes: number | undefined,
    file: Express.Multer.File | undefined,
  ): Promise<PatientPhoto> {
    if (templateId) {
      const template = await this.templateRepo.findOne({
        where: { id: templateId },
        relations: { group: true },
      });
      if (
        !template ||
        (template.group.clinicId !== null &&
          template.group.clinicId !== clinicId)
      ) {
        throw new BadRequestException('Slot folder tidak valid');
      }
    }
    const fileUrl = patientPhotoFileToUrl(file);
    if (!fileUrl) throw new BadRequestException('Foto wajib diunggah');
    try {
      await this.storageQuota?.assertRoom(clinicId, file?.size ?? 0);
    } catch (error) {
      this.deleteFile(fileUrl);
      throw error;
    }
    const photo = this.photoRepo.create({
      patientId,
      encounterId,
      templateId: templateId ?? null,
      fileUrl,
      originalName: file?.originalname,
      takenAt: new Date(),
      takenBy: userId,
      originalSizeBytes: originalSizeBytes ?? file?.size ?? null,
      compressedSizeBytes: file?.size ?? null,
    });
    const saved = await this.photoRepo.save(photo);
    await this.storageQuota?.record(
      clinicId,
      StorageKind.PATIENT_PHOTO,
      fileUrl,
      file?.size ?? 0,
    );
    return toApiUrl(saved);
  }

  async removeForPatient(
    patientId: number,
    clinicId: number,
    photoId: number,
  ): Promise<void> {
    await this.assertPatient(patientId, clinicId);
    const photo = await this.photoRepo.findOne({
      where: { id: photoId, patientId },
    });
    if (!photo) throw new NotFoundException('Foto tidak ditemukan');
    await this.photoRepo.delete({ id: photoId });
    this.deleteFile(photo.fileUrl);
    await this.storageQuota?.forget(StorageKind.PATIENT_PHOTO, photo.fileUrl);
  }

  async getFilePathForPatient(
    patientId: number,
    clinicId: number,
    photoId: number,
  ): Promise<{ absolutePath: string; originalName: string | null }> {
    await this.assertPatient(patientId, clinicId);
    const photo = await this.photoRepo.findOne({
      where: { id: photoId, patientId },
    });
    if (!photo) throw new NotFoundException('Foto tidak ditemukan');
    const absolutePath = join(process.cwd(), photo.fileUrl.replace(/^\//, ''));
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File foto tidak ditemukan');
    }
    return { absolutePath, originalName: photo.originalName };
  }

  /** Foto-foto kontrol ini saja (dipakai saat mengisi slot di encounter). */
  async listByEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<PatientPhoto[]> {
    await this.assertEncounter(encounterId, clinicId);
    const photos = await this.photoRepo.find({
      where: { encounterId },
      relations: { template: true },
      order: { id: 'DESC' },
    });
    return photos.map(toApiUrl);
  }

  async remove(
    encounterId: number,
    clinicId: number,
    photoId: number,
  ): Promise<void> {
    await this.assertEncounter(encounterId, clinicId);
    const photo = await this.photoRepo.findOne({
      where: { id: photoId, encounterId },
    });
    if (!photo) throw new NotFoundException('Foto tidak ditemukan');
    await this.photoRepo.delete({ id: photoId });
    this.deleteFile(photo.fileUrl);
    await this.storageQuota?.forget(StorageKind.PATIENT_PHOTO, photo.fileUrl);
  }

  async getFilePath(
    encounterId: number,
    clinicId: number,
    photoId: number,
  ): Promise<{ absolutePath: string; originalName: string | null }> {
    await this.assertEncounter(encounterId, clinicId);
    const photo = await this.photoRepo.findOne({
      where: { id: photoId, encounterId },
    });
    if (!photo) throw new NotFoundException('Foto tidak ditemukan');
    const absolutePath = join(process.cwd(), photo.fileUrl.replace(/^\//, ''));
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File foto tidak ditemukan');
    }
    return { absolutePath, originalName: photo.originalName };
  }

  private async assertEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<Encounter> {
    const encounter = await this.encounterRepo.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Kunjungan dengan ID ${encounterId} tidak ditemukan`,
      );
    }
    return encounter;
  }

  async setConsent(
    patientId: number,
    clinicId: number,
    userId: number,
    consent: boolean | null | undefined,
  ): Promise<Patient> {
    const patient = await this.assertPatient(patientId, clinicId);
    patient.photoConsentMarketing = consent ?? null;
    patient.photoConsentUpdatedAt = new Date();
    patient.photoConsentUpdatedBy = userId;
    return this.patientRepo.save(patient);
  }

  /** Foto-foto pasien yang sudah consent — satu-satunya sumber yang boleh dipilih untuk konten. */
  async listConsentedPhotoIds(
    patientId: number,
    clinicId: number,
  ): Promise<number[]> {
    const patient = await this.assertPatient(patientId, clinicId);
    if (patient.photoConsentMarketing !== true) return [];
    const photos = await this.photoRepo.find({
      where: { patientId },
      select: { id: true },
    });
    return photos.map((p) => p.id);
  }

  async findManyByIds(ids: number[]): Promise<PatientPhoto[]> {
    if (ids.length === 0) return [];
    return this.photoRepo.find({ where: { id: In(ids) } });
  }

  /**
   * Pasien yang punya foto klinis dan izin konten aktifnya sudah diatur di
   * rekam medis, untuk dipilih dulu di Konten. Ringkas: satu baris per pasien
   * (jumlah foto + tanggal terakhir), bisa dicari, maksimal 40.
   */
  async listLibraryPatients(clinicId: number, search?: string, limit = 40) {
    const qb = this.photoRepo
      .createQueryBuilder('photo')
      .innerJoin('photo.patient', 'patient')
      .select('patient.id', 'id')
      .addSelect('patient.name', 'name')
      .addSelect('patient.noRm', 'noRm')
      .addSelect('COUNT(photo.id)', 'photoCount')
      .addSelect('MAX(photo.takenAt)', 'lastAt')
      .where('patient.clinicId = :clinicId', { clinicId })
      .andWhere('patient.photoConsentMarketing = :yes', { yes: true });
    const term = search?.trim();
    if (term) {
      qb.andWhere('(patient.name LIKE :term OR patient.noRm LIKE :term)', {
        term: `%${term.replace(/[\\%_]/g, '\\$&')}%`,
      });
    }
    const rows = await qb
      .groupBy('patient.id')
      .addGroupBy('patient.name')
      .addGroupBy('patient.noRm')
      .orderBy('lastAt', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: number;
        name: string;
        noRm: string | null;
        photoCount: string;
        lastAt: Date | string | null;
      }>();
    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      noRm: r.noRm ?? '',
      photoCount: Number(r.photoCount),
      lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null,
    }));
  }

  async isConsented(patientId: number, clinicId: number): Promise<boolean> {
    const patient = await this.assertPatient(patientId, clinicId);
    return patient.photoConsentMarketing === true;
  }

  /** Dipakai saat konten menambahkan foto ini — verifikasi klinik pemiliknya. */
  async findByIdForClinic(
    photoId: number,
    clinicId: number,
  ): Promise<PatientPhoto | null> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId } });
    if (!photo) return null;
    const patient = await this.patientRepo.findOne({
      where: { id: photo.patientId, clinicId },
    });
    return patient ? photo : null;
  }

  async getFilePathById(
    photoId: number,
    clinicId: number,
  ): Promise<{ absolutePath: string; originalName: string | null }> {
    const photo = await this.findByIdForClinic(photoId, clinicId);
    if (!photo) throw new NotFoundException('Foto tidak ditemukan');
    const absolutePath = join(process.cwd(), photo.fileUrl.replace(/^\//, ''));
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File foto tidak ditemukan');
    }
    return { absolutePath, originalName: photo.originalName };
  }

  private deleteFile(fileUrl: string) {
    const filePath = join(process.cwd(), fileUrl.replace(/^\//, ''));
    if (existsSync(filePath)) unlinkSync(filePath);
  }

  private async assertPatient(
    patientId: number,
    clinicId: number,
  ): Promise<Patient> {
    const patient = await this.patientRepo.findOne({
      where: { id: patientId, clinicId },
    });
    if (!patient) {
      throw new NotFoundException(
        `Pasien dengan ID ${patientId} tidak ditemukan`,
      );
    }
    return patient;
  }
}

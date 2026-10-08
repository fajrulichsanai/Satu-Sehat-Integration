import { SatusehatClientService } from '../satusehat/satusehat-client.service';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Practitioner } from './entities/practitioner.entity';
import {
  PractitionerChange,
  PractitionerRevision,
} from './entities/practitioner-revision.entity';
import {
  CreatePractitionerDto,
  UpdatePractitionerDto,
  SearchSatusehatPractitionerDto,
} from './dto/practitioner.dto';
import { hashNik, maskNik } from '../../common/utils/nik-crypto.util';

const NIK_SYSTEM = 'https://fhir.kemkes.go.id/id/nik';

/** Field yang bisa direvisi beserta labelnya di riwayat revisi. */
const REVISABLE: Record<string, string> = {
  name: 'Nama',
  gender: 'Jenis kelamin',
  profession: 'Profesi',
  birthPlace: 'Tempat lahir',
  birthDate: 'Tanggal lahir',
  address: 'Alamat',
  phone: 'No. HP',
  email: 'Email',
  specialization: 'Spesialisasi',
  sipNumber: 'No. SIP',
  sipExpiredAt: 'Masa berlaku SIP',
  strNumber: 'No. STR',
  strExpiredAt: 'Masa berlaku STR',
  satusehatPractitionerId: 'ID SATUSEHAT',
  isActive: 'Status aktif',
};

const DATE_FIELDS = new Set(['birthDate', 'sipExpiredAt', 'strExpiredAt']);

export interface PractitionerActor {
  userId: number;
  name?: string;
}

export interface SatusehatPractitionerResult {
  id: string;
  name: string | null;
  gender: string | null;
  birthDate: string | null;
  nikMasked: string | null;
  city: string | null;
  /** Nakes klinik yang sudah memakai ID SATUSEHAT/NIK ini */
  inClinic: { id: number; name: string } | null;
}

/** 'YYYY-MM-DD' dari Date/string tanggal; null bila kosong. */
function toDateString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const off = v.getTimezoneOffset() * 60000;
    return new Date(v.getTime() - off).toISOString().slice(0, 10);
  }
  return typeof v === 'string' ? v.slice(0, 10) : null;
}

function normalize(field: string, v: unknown): unknown {
  if (DATE_FIELDS.has(field)) return toDateString(v);
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  return v ?? null;
}

function display(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'Aktif' : 'Nonaktif';
  return typeof v === 'string' || typeof v === 'number'
    ? String(v)
    : JSON.stringify(v);
}

/** Bentuk aman untuk API: NIK tidak pernah dikirim utuh. */
export function practitionerView(p: Practitioner) {
  const {
    nik,
    nikHash: _nikHash,
    ...rest
  } = p as Practitioner & {
    nikHash?: string | null;
  };
  void _nikHash;
  return {
    ...rest,
    birthDate: toDateString(p.birthDate),
    sipExpiredAt: toDateString(p.sipExpiredAt),
    strExpiredAt: toDateString(p.strExpiredAt),
    hasNik: !!nik,
    nikMasked: nik ? maskNik(nik) : null,
  };
}

@Injectable()
export class PractitionersService {
  private readonly logger = new Logger(PractitionersService.name);

  constructor(
    @InjectRepository(Practitioner)
    private practitionerRepository: Repository<Practitioner>,
    @InjectRepository(PractitionerRevision)
    private revisionRepository: Repository<PractitionerRevision>,
    private readonly satusehatClient: SatusehatClientService,
  ) {}

  async findAll(clinicId: number) {
    const practitioners = await this.practitionerRepository.find({
      where: { clinicId },
      order: { name: 'ASC' },
    });
    return { success: true, data: practitioners.map(practitionerView) };
  }

  async findOne(id: number, clinicId: number) {
    return {
      success: true,
      data: practitionerView(await this.load(id, clinicId)),
    };
  }

  async create(
    dto: CreatePractitionerDto,
    clinicId: number,
    createdBy: number,
  ) {
    const nikHash = dto.nik ? hashNik(dto.nik) : null;
    const existing = nikHash
      ? await this.practitionerRepository.findOne({
          where: { nikHash, clinicId },
        })
      : null;
    if (existing) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'DUPLICATE_NIK',
          message: `NIK sudah terdaftar di klinik ini (${existing.name})`,
        },
      });
    }

    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) fields[k] = normalize(k, v);
    const practitioner = this.practitionerRepository.create({
      ...(fields as Partial<Practitioner>),
      name: dto.name?.trim(),
      nik: dto.nik,
      nikHash,
      clinicId,
      createdBy,
      updatedBy: createdBy,
    });
    const saved = await this.practitionerRepository.save(practitioner);
    this.logger.log(
      `[CREATE] Nakes didaftarkan | id=${saved.id}, clinicId=${clinicId}, nik=${maskNik(dto.nik)}`,
    );
    return {
      success: true,
      data: practitionerView(saved),
      message: 'Tenaga kesehatan berhasil didaftarkan',
    };
  }

  /**
   * Revisi data nakes. Hanya field yang benar-benar berubah yang disimpan &
   * dicatat di riwayat revisi (NIK tersamar). NIK baru me-reset ID SATUSEHAT
   * supaya dicocokkan ulang — ID lama milik NIK yang salah.
   */
  async update(
    id: number,
    dto: UpdatePractitionerDto,
    clinicId: number,
    actor: number | PractitionerActor,
  ) {
    const by: PractitionerActor =
      typeof actor === 'number' ? { userId: actor } : actor;
    const practitioner = await this.load(id, clinicId);
    const changes: PractitionerChange[] = [];

    if (dto.nik && dto.nik !== practitioner.nik) {
      const nikHash = hashNik(dto.nik);
      const dup = await this.practitionerRepository.findOne({
        where: { nikHash, clinicId },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException({
          success: false,
          error: {
            code: 'DUPLICATE_NIK',
            message: `NIK ini sudah dipakai ${dup.name}`,
          },
        });
      }
      changes.push({
        field: 'nik',
        label: 'NIK',
        from: practitioner.nik ? maskNik(practitioner.nik) : null,
        to: maskNik(dto.nik),
      });
      practitioner.nik = dto.nik;
      practitioner.nikHash = nikHash;
      if (
        practitioner.satusehatPractitionerId &&
        dto.satusehatPractitionerId === undefined
      ) {
        changes.push({
          field: 'satusehatPractitionerId',
          label: REVISABLE.satusehatPractitionerId,
          from: practitioner.satusehatPractitionerId,
          to: null,
        });
        (
          practitioner as { satusehatPractitionerId: string | null }
        ).satusehatPractitionerId = null;
      }
    }

    for (const [field, label] of Object.entries(REVISABLE)) {
      const raw = (dto as Record<string, unknown>)[field];
      if (raw === undefined) continue;
      if (field === 'name' && (typeof raw !== 'string' || !raw.trim())) {
        throw new BadRequestException('Nama tidak boleh kosong');
      }
      const next = normalize(field, raw);
      const prev = normalize(field, (practitioner as any)[field]);
      if (next === prev) continue;
      changes.push({ field, label, from: display(prev), to: display(next) });
      (practitioner as any)[field] = next;
    }

    if (changes.length === 0) {
      return {
        success: true,
        data: practitionerView(practitioner),
        message: 'Tidak ada perubahan',
      };
    }

    practitioner.updatedBy = by.userId;
    const saved = await this.practitionerRepository.save(practitioner);
    await this.revisionRepository.save(
      this.revisionRepository.create({
        clinicId,
        practitionerId: id,
        changedBy: by.userId,
        changedByName: by.name?.slice(0, 100) ?? null,
        reason: dto.reason?.trim() || null,
        changes,
      }),
    );
    this.logger.log(
      `[UPDATE] Revisi nakes | id=${id}, clinicId=${clinicId}, fields=${changes.map((c) => c.field).join(',')}`,
    );
    return {
      success: true,
      data: practitionerView(saved),
      message: 'Data tenaga kesehatan diperbarui',
    };
  }

  async revisions(id: number, clinicId: number) {
    await this.load(id, clinicId);
    const rows = await this.revisionRepository.find({
      where: { practitionerId: id, clinicId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 50,
    });
    return { success: true, data: rows };
  }

  async remove(id: number, clinicId: number) {
    const practitioner = await this.load(id, clinicId);
    await this.practitionerRepository.remove(practitioner);
    this.logger.log(`[DELETE] Nakes dihapus | id=${id}, clinicId=${clinicId}`);
    return {
      success: true,
      data: { message: 'Tenaga kesehatan berhasil dihapus' },
    };
  }

  /**
   * Cari tenaga kesehatan di SATUSEHAT (SISDMK) dengan salah satu cara:
   * NIK, ID SATUSEHAT (IHS), atau nama + jenis kelamin + tanggal lahir.
   */
  async searchSatusehat(dto: SearchSatusehatPractitionerDto, clinicId: number) {
    let resources: any[] = [];
    if (dto.nik) {
      const bundle = await this.satusehatClient.searchPractitionerByNik(
        clinicId,
        dto.nik,
      );
      resources = (bundle?.entry ?? []).map((e: any) => e.resource);
    } else if (dto.ihsId) {
      const { status, data } = await this.satusehatClient.getFhir(
        clinicId,
        `Practitioner/${encodeURIComponent(dto.ihsId)}`,
      );
      if (status < 300 && data?.resourceType === 'Practitioner') {
        resources = [data];
      }
    } else if (dto.name && dto.gender && dto.birthDate) {
      const q = new URLSearchParams({
        name: dto.name.trim(),
        gender: dto.gender,
        birthdate: dto.birthDate.slice(0, 10),
      });
      const { data } = await this.satusehatClient.getFhir(
        clinicId,
        `Practitioner?${q.toString()}`,
      );
      resources = (data?.entry ?? []).map((e: any) => e.resource);
    } else {
      throw new BadRequestException(
        'Isi NIK, ID SATUSEHAT, atau nama + jenis kelamin + tanggal lahir',
      );
    }

    const ours = await this.practitionerRepository.find({
      where: { clinicId },
    });
    const ourNikHash = dto.nik ? hashNik(dto.nik) : null;
    const results: SatusehatPractitionerResult[] = resources
      .filter((r) => r?.id)
      .slice(0, 20)
      .map((r) => {
        const nik = (r.identifier ?? []).find(
          (i: any) => i.system === NIK_SYSTEM,
        )?.value as string | undefined;
        const match = ours.find(
          (p) =>
            p.satusehatPractitionerId === r.id ||
            (!!ourNikHash && p.nikHash === ourNikHash),
        );
        return {
          id: String(r.id),
          name: r.name?.[0]?.text ?? null,
          gender: r.gender ?? null,
          birthDate: r.birthDate ?? null,
          nikMasked: nik ? maskNik(nik) : null,
          city: r.address?.[0]?.city ?? null,
          inClinic: match ? { id: match.id, name: match.name } : null,
        };
      });
    return {
      success: true,
      data: {
        found: results.length > 0,
        results,
        // kompatibel dengan pemanggil lama (pencarian NIK tunggal)
        ...(results[0]
          ? {
              id: results[0].id,
              name: results[0].name ?? undefined,
              gender: results[0].gender ?? undefined,
            }
          : { message: 'Tenaga kesehatan tidak ditemukan di SATUSEHAT' }),
      },
    };
  }

  /**
   * Cocokkan nakes klinik dengan SATUSEHAT memakai NIK tersimpan. ID IHS
   * disimpan bila ditemukan; nama versi SATUSEHAT dikembalikan agar salah
   * ketik nama bisa langsung direvisi.
   */
  async matchSatusehat(id: number, clinicId: number, actor: PractitionerActor) {
    const practitioner = await this.load(id, clinicId);
    if (!practitioner.nik) {
      throw new BadRequestException(
        'Isi NIK terlebih dahulu untuk mencocokkan dengan SATUSEHAT',
      );
    }
    const bundle = await this.satusehatClient.searchPractitionerByNik(
      clinicId,
      practitioner.nik,
    );
    const r = bundle?.entry?.[0]?.resource;
    if (!r?.id) {
      return {
        success: true,
        data: {
          found: false,
          message:
            'NIK tidak ditemukan di SATUSEHAT — periksa NIK atau data SISDMK nakes',
        },
      };
    }
    const satusehatName: string | null = r.name?.[0]?.text ?? null;
    let data = practitionerView(practitioner);
    if (practitioner.satusehatPractitionerId !== r.id) {
      data = (
        await this.update(
          id,
          {
            satusehatPractitionerId: String(r.id),
            reason: 'Dicocokkan dengan SATUSEHAT',
          },
          clinicId,
          actor,
        )
      ).data;
    }
    const norm = (s: string | null | undefined) =>
      (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      success: true,
      data: {
        found: true,
        satusehatId: String(r.id),
        satusehatName,
        satusehatGender: r.gender ?? null,
        satusehatBirthDate: r.birthDate ?? null,
        // Nama lokal boleh memuat gelar (drg., Sp.KG) di luar nama SATUSEHAT
        nameMatches:
          !!norm(satusehatName) &&
          norm(practitioner.name).includes(norm(satusehatName)),
        practitioner: data,
      },
    };
  }

  private async load(id: number, clinicId: number) {
    const practitioner = await this.practitionerRepository.findOne({
      where: { id, clinicId },
    });
    if (!practitioner) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PRACTITIONER_NOT_FOUND',
          message: 'Tenaga kesehatan tidak ditemukan',
        },
      });
    }
    return practitioner;
  }
}

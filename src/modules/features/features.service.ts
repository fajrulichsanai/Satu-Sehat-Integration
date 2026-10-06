import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLE_LEVEL, UserRole } from '../../enums/user-role.enum';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { ClinicFeature } from './entities/clinic-feature.entity';
import { CustomFeature } from './entities/custom-feature.entity';
import { UserFeature } from './entities/user-feature.entity';
import {
  CLINIC_ROLES,
  CUSTOM_PREFIX,
  ROLE_DEFAULT_FEATURES,
  STANDARD_FEATURES,
  TOGGLEABLE_FEATURES,
  isCustomFeature,
} from './feature-catalog';
import { CreateCustomFeatureDto } from './dto/features.dto';

export interface FeatureActor {
  userId: number;
  role: UserRole;
  clinicId?: number | null;
}

/** Pengaturan dibaca sering (guard tiap request) — disimpan sebentar di memori */
const CACHE_MS = 30_000;

/**
 * Kontrol fitur:
 *  - super admin menyalakan/mematikan fitur per klinik (termasuk fitur custom)
 *  - owner menyalakan/mematikan fitur per user, terbatas pada fitur yang tersedia di klinik
 * Fitur efektif user = bawaan role, dikurangi yang dimatikan klinik, lalu
 * pengaturan per user. Fitur custom mati secara bawaan (kecuali untuk owner
 * bila kliniknya menyalakan) dan hanya muncul untuk user yang dinyalakan.
 */
@Injectable()
export class FeaturesService {
  private cache = new Map<
    string,
    { at: number; value: Map<string, boolean> }
  >();

  constructor(
    @InjectRepository(CustomFeature)
    private readonly customRepo: Repository<CustomFeature>,
    @InjectRepository(ClinicFeature)
    private readonly clinicFeatureRepo: Repository<ClinicFeature>,
    @InjectRepository(UserFeature)
    private readonly userFeatureRepo: Repository<UserFeature>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
  ) {}

  // ── Fitur efektif ─────────────────────────────────────────────────────

  async effectiveFor(actor: FeatureActor) {
    const roleDefaults = ROLE_DEFAULT_FEATURES[actor.role] ?? [];
    if (!actor.clinicId || !CLINIC_ROLES.includes(actor.role)) {
      return {
        features: [...roleDefaults],
        custom: [] as { key: string; name: string }[],
      };
    }
    const [clinic, user, customs] = await Promise.all([
      this.clinicSettings(actor.clinicId),
      this.userSettings(actor.userId, actor.clinicId),
      this.customRepo.find({ order: { name: 'ASC' } }),
    ]);
    const features = new Set<string>();
    for (const f of STANDARD_FEATURES) {
      const def = roleDefaults.includes(f.key);
      if (!f.toggleable) {
        if (def) features.add(f.key);
        continue;
      }
      if (clinic.get(f.key) === false) continue;
      if (user.get(f.key) ?? def) features.add(f.key);
    }
    const custom: { key: string; name: string }[] = [];
    for (const c of customs) {
      if (clinic.get(c.key) !== true) continue;
      if (user.get(c.key) ?? actor.role === UserRole.OWNER) {
        features.add(c.key);
        custom.push({ key: c.key, name: c.name });
      }
    }
    return { features: [...features], custom };
  }

  /**
   * Untuk guard backend: hanya fitur yang *sengaja dimatikan* (klinik / user)
   * yang ditolak. Bawaan role tidak ditegakkan di sini — sudah oleh @Roles.
   */
  async isExplicitlyDisabled(
    actor: FeatureActor,
    key: string,
  ): Promise<boolean> {
    if (!actor.clinicId || !CLINIC_ROLES.includes(actor.role)) return false;
    const clinic = await this.clinicSettings(actor.clinicId);
    if (isCustomFeature(key)) {
      if (clinic.get(key) !== true) return true;
      const user = await this.userSettings(actor.userId, actor.clinicId);
      return !(user.get(key) ?? actor.role === UserRole.OWNER);
    }
    if (!TOGGLEABLE_FEATURES.includes(key)) return false;
    if (clinic.get(key) === false) return true;
    const user = await this.userSettings(actor.userId, actor.clinicId);
    return user.get(key) === false;
  }

  // ── Super admin: fitur klinik & fitur custom ──────────────────────────

  async clinicFeatures(clinicId: number) {
    await this.assertClinic(clinicId);
    const [settings, customs] = await Promise.all([
      this.clinicSettings(clinicId, true),
      this.customRepo.find({ order: { name: 'ASC' } }),
    ]);
    return {
      standard: STANDARD_FEATURES.filter((f) => f.toggleable).map((f) => ({
        key: f.key,
        label: f.label,
        enabled: settings.get(f.key) ?? true,
        isDefault: !settings.has(f.key),
      })),
      custom: customs.map((c) => ({
        key: c.key,
        label: c.name,
        description: c.description,
        enabled: settings.get(c.key) ?? false,
        isDefault: !settings.has(c.key),
      })),
    };
  }

  async setClinicFeature(
    clinicId: number,
    key: string,
    enabled: boolean | null,
    by: number,
  ) {
    await this.assertClinic(clinicId);
    await this.assertKnownKey(key);
    if (enabled === null) {
      await this.clinicFeatureRepo.delete({ clinicId, featureKey: key });
    } else {
      const row =
        (await this.clinicFeatureRepo.findOne({
          where: { clinicId, featureKey: key },
        })) ??
        this.clinicFeatureRepo.create({
          clinicId,
          featureKey: key,
          createdBy: by,
        });
      Object.assign(row, { enabled, updatedBy: by });
      await this.clinicFeatureRepo.save(row);
    }
    this.invalidate(`c:${clinicId}`);
    return this.clinicFeatures(clinicId);
  }

  listCustom() {
    return this.customRepo.find({ order: { name: 'ASC' } });
  }

  async createCustom(dto: CreateCustomFeatureDto, by: number) {
    const key = `${CUSTOM_PREFIX}${dto.key}`;
    if (await this.customRepo.exists({ where: { key } })) {
      throw new ConflictException(`Fitur ${key} sudah ada`);
    }
    return this.customRepo.save(
      this.customRepo.create({
        key,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdBy: by,
        updatedBy: by,
      }),
    );
  }

  async deleteCustom(id: number) {
    const feature = await this.customRepo.findOne({ where: { id } });
    if (!feature) throw new NotFoundException('Fitur custom tidak ditemukan');
    await Promise.all([
      this.clinicFeatureRepo.delete({ featureKey: feature.key }),
      this.userFeatureRepo.delete({ featureKey: feature.key }),
    ]);
    await this.customRepo.delete({ id });
    this.cache.clear();
  }

  // ── Owner: fitur per user ─────────────────────────────────────────────

  async userFeatures(actor: FeatureActor, targetUserId: number) {
    const { target, clinicId } = await this.assertCanManageUser(
      actor,
      targetUserId,
    );
    const [clinic, settings, customs] = await Promise.all([
      this.clinicSettings(clinicId),
      this.userSettings(target.id, clinicId, true),
      this.customRepo.find({ order: { name: 'ASC' } }),
    ]);
    const roleDefaults = ROLE_DEFAULT_FEATURES[target.role] ?? [];
    const standard = STANDARD_FEATURES.filter(
      (f) => f.toggleable && clinic.get(f.key) !== false,
    ).map((f) => {
      const def = roleDefaults.includes(f.key);
      return {
        key: f.key,
        label: f.label,
        roleDefault: def,
        enabled: settings.get(f.key) ?? def,
        isDefault: !settings.has(f.key),
      };
    });
    const custom = customs
      .filter((c) => clinic.get(c.key) === true)
      .map((c) => ({
        key: c.key,
        label: c.name,
        description: c.description,
        roleDefault: target.role === UserRole.OWNER,
        enabled: settings.get(c.key) ?? target.role === UserRole.OWNER,
        isDefault: !settings.has(c.key),
      }));
    return {
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
      },
      standard,
      custom,
    };
  }

  async setUserFeature(
    actor: FeatureActor,
    targetUserId: number,
    key: string,
    enabled: boolean | null,
  ) {
    const { target, clinicId } = await this.assertCanManageUser(
      actor,
      targetUserId,
    );
    await this.assertKnownKey(key);
    const clinic = await this.clinicSettings(clinicId);
    const availableInClinic = isCustomFeature(key)
      ? clinic.get(key) === true
      : clinic.get(key) !== false;
    if (!availableInClinic) {
      throw new BadRequestException(
        'Fitur ini tidak tersedia untuk klinik Anda',
      );
    }
    if (enabled === null) {
      await this.userFeatureRepo.delete({
        userId: target.id,
        clinicId,
        featureKey: key,
      });
    } else {
      const row =
        (await this.userFeatureRepo.findOne({
          where: { userId: target.id, clinicId, featureKey: key },
        })) ??
        this.userFeatureRepo.create({
          userId: target.id,
          clinicId,
          featureKey: key,
          createdBy: actor.userId,
        });
      Object.assign(row, { enabled, updatedBy: actor.userId });
      await this.userFeatureRepo.save(row);
    }
    this.invalidate(`u:${target.id}:${clinicId}`);
    return this.userFeatures(actor, targetUserId);
  }

  // ── Bantuan ───────────────────────────────────────────────────────────

  private async assertCanManageUser(actor: FeatureActor, targetUserId: number) {
    const target = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User tidak ditemukan');
    const clinicId =
      actor.role === UserRole.SUPER_ADMIN ? target.clinicId : actor.clinicId;
    if (!clinicId || target.clinicId !== clinicId)
      throw new NotFoundException('User tidak ditemukan');
    if (!CLINIC_ROLES.includes(target.role)) {
      throw new BadRequestException(
        'Fitur hanya bisa diatur untuk owner, admin, dokter, dan perawat',
      );
    }
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      (target.id === actor.userId ||
        ROLE_LEVEL[target.role] <= ROLE_LEVEL[actor.role])
    ) {
      throw new ForbiddenException('Anda tidak bisa mengatur fitur user ini');
    }
    return { target, clinicId };
  }

  private async assertClinic(clinicId: number) {
    if (!(await this.clinicRepo.exists({ where: { id: clinicId } }))) {
      throw new NotFoundException('Klinik tidak ditemukan');
    }
  }

  private async assertKnownKey(key: string) {
    if (isCustomFeature(key)) {
      if (!(await this.customRepo.exists({ where: { key } }))) {
        throw new BadRequestException(`Fitur ${key} tidak dikenal`);
      }
      return;
    }
    if (!TOGGLEABLE_FEATURES.includes(key)) {
      throw new BadRequestException(`Fitur ${key} tidak bisa diatur`);
    }
  }

  private async clinicSettings(clinicId: number, fresh = false) {
    return this.cached(`c:${clinicId}`, fresh, async () => {
      const rows = await this.clinicFeatureRepo.find({ where: { clinicId } });
      return new Map(rows.map((r) => [r.featureKey, !!r.enabled]));
    });
  }

  private async userSettings(userId: number, clinicId: number, fresh = false) {
    return this.cached(`u:${userId}:${clinicId}`, fresh, async () => {
      const rows = await this.userFeatureRepo.find({
        where: { userId, clinicId },
      });
      return new Map(rows.map((r) => [r.featureKey, !!r.enabled]));
    });
  }

  private async cached(
    key: string,
    fresh: boolean,
    load: () => Promise<Map<string, boolean>>,
  ) {
    const hit = this.cache.get(key);
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await load();
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  private invalidate(key: string) {
    this.cache.delete(key);
  }
}

import {
  BadRequestException,
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
import { UserFeature } from './entities/user-feature.entity';
import {
  CLINIC_ROLES,
  ROLE_DEFAULT_FEATURES,
  SATUSEHAT_FEATURE,
  STANDARD_FEATURES,
  TOGGLEABLE_FEATURES,
  OPT_IN_FEATURES,
} from './feature-catalog';
import { PlatformSettingsService } from './platform-settings.service';

export interface FeatureActor {
  userId: number;
  role: UserRole;
  clinicId?: number | null;
}

/** Pengaturan dibaca sering (guard tiap request) — disimpan sebentar di memori */
const CACHE_MS = 30_000;

/**
 * Kontrol fitur:
 *  - super admin menyalakan/mematikan fitur per klinik
 *  - owner menyalakan/mematikan fitur per user, terbatas pada fitur yang tersedia di klinik
 * Fitur efektif user = bawaan role, dikurangi yang dimatikan klinik, lalu
 * pengaturan per user. SATUSEHAT juga harus dinyalakan di tingkat platform
 * (saklar global super admin) — selama mati, fitur itu tidak ada untuk siapa pun.
 */
@Injectable()
export class FeaturesService {
  private cache = new Map<
    string,
    { at: number; value: Map<string, boolean> }
  >();

  constructor(
    @InjectRepository(ClinicFeature)
    private readonly clinicFeatureRepo: Repository<ClinicFeature>,
    @InjectRepository(UserFeature)
    private readonly userFeatureRepo: Repository<UserFeature>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    private readonly platform: PlatformSettingsService,
  ) {}

  // ── Fitur efektif ─────────────────────────────────────────────────────

  async effectiveFor(actor: FeatureActor) {
    const roleDefaults = ROLE_DEFAULT_FEATURES[actor.role] ?? [];
    if (!actor.clinicId || !CLINIC_ROLES.includes(actor.role)) {
      return { features: [...roleDefaults] };
    }
    const [clinic, user, satusehatOn] = await Promise.all([
      this.clinicSettings(actor.clinicId),
      this.userSettings(actor.userId, actor.clinicId),
      this.platform.isSatusehatEnabled(),
    ]);
    const features = new Set<string>();
    for (const f of STANDARD_FEATURES) {
      const def = roleDefaults.includes(f.key);
      if (!f.toggleable) {
        if (def) features.add(f.key);
        continue;
      }
      if (f.key === SATUSEHAT_FEATURE && !satusehatOn) continue;
      if (clinic.get(f.key) === false) continue;
      if (OPT_IN_FEATURES.has(f.key) && clinic.get(f.key) !== true) continue;
      if (user.get(f.key) ?? def) features.add(f.key);
    }
    return { features: [...features] };
  }

  /**
   * Untuk guard backend: hanya fitur yang *sengaja dimatikan* (platform /
   * klinik / user) yang ditolak. Bawaan role tidak ditegakkan di sini — sudah
   * oleh @Roles.
   */
  async isExplicitlyDisabled(
    actor: FeatureActor,
    key: string,
  ): Promise<boolean> {
    if (
      key === SATUSEHAT_FEATURE &&
      !(await this.platform.isSatusehatEnabled())
    ) {
      return true;
    }
    if (!actor.clinicId || !CLINIC_ROLES.includes(actor.role)) return false;
    if (!TOGGLEABLE_FEATURES.includes(key)) return false;
    const clinic = await this.clinicSettings(actor.clinicId);
    if (clinic.get(key) === false) return true;
    if (OPT_IN_FEATURES.has(key) && clinic.get(key) !== true) return true;
    const user = await this.userSettings(actor.userId, actor.clinicId);
    return user.get(key) === false;
  }

  /**
   * SATUSEHAT berjalan untuk klinik ini: saklar global menyala dan klinik
   * tidak mematikannya. Dipakai semua jalur yang mengirim/mengambil data
   * SATUSEHAT, termasuk pengiriman otomatis di latar belakang.
   */
  async isSatusehatActive(clinicId: number): Promise<boolean> {
    if (!(await this.platform.isSatusehatEnabled())) return false;
    const clinic = await this.clinicSettings(clinicId);
    return clinic.get(SATUSEHAT_FEATURE) !== false;
  }

  // ── Owner klinik: saklar SATUSEHAT kliniknya ──────────────────────────

  async clinicSatusehat(clinicId: number) {
    const [globalEnabled, clinic] = await Promise.all([
      this.platform.isSatusehatEnabled(),
      this.clinicSettings(clinicId, true),
    ]);
    const enabled = clinic.get(SATUSEHAT_FEATURE) !== false;
    return { globalEnabled, enabled, active: globalEnabled && enabled };
  }

  async setClinicSatusehat(clinicId: number, enabled: boolean, by: number) {
    await this.saveClinicSetting(clinicId, SATUSEHAT_FEATURE, enabled, by);
    return this.clinicSatusehat(clinicId);
  }

  // ── Super admin: fitur klinik ─────────────────────────────────────────

  async clinicFeatures(clinicId: number) {
    await this.assertClinic(clinicId);
    const [settings, satusehatGlobalEnabled] = await Promise.all([
      this.clinicSettings(clinicId, true),
      this.platform.isSatusehatEnabled(),
    ]);
    return {
      satusehatGlobalEnabled,
      standard: STANDARD_FEATURES.filter((f) => f.toggleable).map((f) => ({
        key: f.key,
        label: f.label,
        enabled: settings.get(f.key) ?? !OPT_IN_FEATURES.has(f.key),
        isDefault: !settings.has(f.key),
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
    this.assertKnownKey(key);
    await this.saveClinicSetting(clinicId, key, enabled, by);
    return this.clinicFeatures(clinicId);
  }

  // ── Owner: fitur per user ─────────────────────────────────────────────

  async userFeatures(actor: FeatureActor, targetUserId: number) {
    const { target, clinicId } = await this.assertCanManageUser(
      actor,
      targetUserId,
    );
    const [clinic, settings, satusehatOn] = await Promise.all([
      this.clinicSettings(clinicId),
      this.userSettings(target.id, clinicId, true),
      this.platform.isSatusehatEnabled(),
    ]);
    const roleDefaults = ROLE_DEFAULT_FEATURES[target.role] ?? [];
    const standard = STANDARD_FEATURES.filter(
      (f) =>
        f.toggleable &&
        (f.key !== SATUSEHAT_FEATURE || satusehatOn) &&
        clinic.get(f.key) !== false &&
        (!OPT_IN_FEATURES.has(f.key) || clinic.get(f.key) === true),
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
    return {
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
      },
      standard,
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
    this.assertKnownKey(key);
    const clinic = await this.clinicSettings(clinicId);
    if (clinic.get(key) === false) {
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

  private async saveClinicSetting(
    clinicId: number,
    key: string,
    enabled: boolean | null,
    by: number,
  ) {
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
  }

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

  private assertKnownKey(key: string) {
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

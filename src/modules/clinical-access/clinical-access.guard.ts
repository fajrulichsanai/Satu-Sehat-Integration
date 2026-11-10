import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ClinicalAccessService } from './clinical-access.service';

const toId = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Guard global: setiap endpoint yang menyentuh pasien/kunjungan (lewat
 * parameter rute atau query) dicek terhadap aturan ClinicalAccessService,
 * jadi modul baru otomatis ikut terlindungi tanpa pengecekan manual.
 */
@Injectable()
export class ClinicalAccessGuard implements CanActivate {
  constructor(private readonly access: ClinicalAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!this.access.isRestricted(user)) return true;

    const path: string = req.route?.path ?? '';
    const params: Record<string, string> = req.params ?? {};
    const query: Record<string, unknown> = req.query ?? {};
    const write = req.method !== 'GET' && req.method !== 'HEAD';

    // Kunjungan
    const encounterId =
      toId(params.encounterId) ??
      (/\/encounters\/:id(\/|$)/.test(path) ? toId(params.id) : null) ??
      (/\/referrals\/:id(\/|$)/.test(path) && toId(params.id)
        ? await this.access.encounterIdOfReferral(toId(params.id)!)
        : null) ??
      toId(query.encounterId);
    if (encounterId) {
      // SSRME hanya membaca rekam medis nasional — cukup akses pasien
      const readOnly = !write || /\/ssrme\//.test(path);
      await this.access.assertEncounter(user, encounterId, !readOnly);
    }

    // Pasien
    let patientId =
      toId(params.patientId) ??
      (/\/patients\/:id(\/|$)/.test(path) ? toId(params.id) : null) ??
      toId(query.patientId);
    if (
      !patientId &&
      /\/treatment-plans\/:id(\/|$)/.test(path) &&
      toId(params.id)
    ) {
      patientId = await this.access.patientIdOf(
        'treatment_plans',
        toId(params.id)!,
      );
    }
    if (
      !patientId &&
      /\/patient-consents\/:id(\/|$)/.test(path) &&
      toId(params.id)
    ) {
      patientId = await this.access.patientIdOf(
        'patient_consents',
        toId(params.id)!,
      );
    }
    if (patientId) await this.access.assertPatient(user, patientId);

    // Daftar persetujuan tanpa filter pasien berisi data seluruh pasien
    if (
      /\/patient-consents$/.test(path) &&
      !write &&
      !patientId &&
      !encounterId
    ) {
      throw new ForbiddenException('Pilih pasien terlebih dahulu');
    }
    return true;
  }
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { isClinician } from '../../enums/user-role.enum';

export interface ClinicalUser {
  userId: number;
  role: string;
  clinicId?: number | null;
}

export const NOT_YOUR_PATIENT =
  'Akses ditolak: pasien ini belum pernah ditangani oleh Anda. Riwayatnya bisa dibuka setelah pasien terdaftar di kunjungan Anda.';

/**
 * Batas akses rekam medis untuk dokter/perawat (owner & admin tidak dibatasi).
 *
 *   - Pasien terbuka bagi nakes yang punya minimal satu kunjungan (tidak
 *     dibatalkan) dengan pasien tsb — termasuk kunjungan hari ini.
 *   - Bila terbuka, SELURUH riwayat pasien terlihat, termasuk kunjungan yang
 *     ditangani dokter lain (kesinambungan perawatan).
 *   - Mengubah data kunjungan hanya boleh untuk kunjungan miliknya sendiri.
 */
@Injectable()
export class ClinicalAccessService {
  constructor(private readonly dataSource: DataSource) {}

  isRestricted(user: ClinicalUser | undefined | null): user is ClinicalUser {
    return !!user && isClinician(user.role);
  }

  async hasPatientAccess(user: ClinicalUser, patientId: number) {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM encounters e
         JOIN practitioners pr ON pr.id = e.practitioner_id
        WHERE e.patient_id = ? AND pr.user_id = ? AND e.status <> 'cancelled'
        LIMIT 1`,
      [patientId, user.userId],
    );
    return rows.length > 0;
  }

  async assertPatient(user: ClinicalUser, patientId: number) {
    if (!this.isRestricted(user)) return;
    if (!(await this.hasPatientAccess(user, patientId))) {
      throw new ForbiddenException(NOT_YOUR_PATIENT);
    }
  }

  /** Baca: pasiennya boleh diakses. Tulis: kunjungan harus milik sendiri. */
  async assertEncounter(
    user: ClinicalUser,
    encounterId: number,
    write: boolean,
  ) {
    if (!this.isRestricted(user)) return;
    const rows: { patient_id: number; own: number }[] =
      await this.dataSource.query(
        `SELECT e.patient_id, (pr.user_id = ?) AS own
           FROM encounters e
           LEFT JOIN practitioners pr ON pr.id = e.practitioner_id
          WHERE e.id = ? LIMIT 1`,
        [user.userId, encounterId],
      );
    if (!rows.length) throw new NotFoundException('Kunjungan tidak ditemukan');
    if (Number(rows[0].own) === 1) return;
    if (write) {
      throw new ForbiddenException(
        'Akses ditolak: hanya dokter penanggung jawab kunjungan ini yang bisa mengubahnya',
      );
    }
    await this.assertPatient(user, Number(rows[0].patient_id));
  }

  /** ID pasien dari tabel yang punya kolom patient_id (null bila tak ada). */
  async patientIdOf(table: 'treatment_plans' | 'patient_consents', id: number) {
    const rows: { patient_id: number }[] = await this.dataSource.query(
      `SELECT patient_id FROM ${table} WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows.length ? Number(rows[0].patient_id) : null;
  }

  async encounterIdOfReferral(id: number) {
    const rows: { encounter_id: number }[] = await this.dataSource.query(
      'SELECT encounter_id FROM referrals WHERE id = ? LIMIT 1',
      [id],
    );
    return rows.length ? Number(rows[0].encounter_id) : null;
  }

  /** Batasi query daftar pasien (alias `p`) ke pasien milik nakes. */
  scopePatients<T extends object>(
    qb: SelectQueryBuilder<T>,
    user: ClinicalUser | undefined | null,
    alias = 'p',
  ) {
    if (!this.isRestricted(user)) return qb;
    return qb.andWhere(
      `EXISTS (SELECT 1 FROM encounters ce
                 JOIN practitioners cpr ON cpr.id = ce.practitioner_id
                WHERE ce.patient_id = ${alias}.id AND cpr.user_id = :caUserId
                  AND ce.status <> 'cancelled')`,
      { caUserId: user.userId },
    );
  }
}

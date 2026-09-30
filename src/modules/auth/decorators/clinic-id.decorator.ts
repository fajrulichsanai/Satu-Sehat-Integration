import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

interface ClinicIdOptions {
  /**
   * Allow a missing clinic (a Super Admin, who belongs to no clinic) and
   * hand the handler `null`. Only for handlers that deal with null
   * themselves — e.g. audit log or payment proofs across all clinics.
   */
  optional?: boolean;
}

/**
 * The clinic the request acts on (set by ClinicContextGuard, else the
 * user's own). Without a clinic — a Super Admin not impersonating an owner —
 * the request is refused with 403 NO_CLINIC_ASSIGNED, instead of reaching a
 * query with `clinicId = null` and failing with a 500.
 *
 * Usage: @ClinicId() clinicId: number
 *        @ClinicId({ optional: true }) clinicId: number | null
 */
export const ClinicId = createParamDecorator(
  (options: ClinicIdOptions | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const clinicId: number | null | undefined =
      request.clinicId || request.user?.clinicId;
    if (clinicId) return clinicId;
    if (options?.optional) return null;
    throw new ForbiddenException({
      success: false,
      error: {
        code: 'NO_CLINIC_ASSIGNED',
        message:
          'Fitur ini hanya untuk akun klinik. Masuk sebagai owner klinik (impersonate) untuk membuka data klinik.',
      },
    });
  },
);

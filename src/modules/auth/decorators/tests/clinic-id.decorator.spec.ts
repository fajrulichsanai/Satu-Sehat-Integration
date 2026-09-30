import { ForbiddenException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ClinicId } from '../clinic-id.decorator';

// Pulls the factory Nest runs for a param decorator so it can be called directly.
function getFactory() {
  class Probe {
    handler(@ClinicId() _clinicId: number) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler');
  return args[Object.keys(args)[0]].factory as (data: unknown, ctx: unknown) => unknown;
}

const ctx = (request: unknown) => ({ switchToHttp: () => ({ getRequest: () => request }) });

describe('ClinicId decorator', () => {
  const factory = getFactory();

  it('returns the clinic set by ClinicContextGuard (positive)', () => {
    expect(factory(undefined, ctx({ clinicId: 7, user: { clinicId: 3 } }))).toBe(7);
  });

  it("falls back to the user's own clinic (positive)", () => {
    expect(factory(undefined, ctx({ user: { clinicId: 3 } }))).toBe(3);
  });

  it('refuses a request without a clinic, e.g. a Super Admin, with 403 instead of querying clinicId = null (negative)', () => {
    expect(() => factory(undefined, ctx({ clinicId: null, user: { role: 'super_admin', clinicId: null } }))).toThrow(
      ForbiddenException,
    );
  });

  it('hands null to handlers that opted in with optional: true (edge)', () => {
    expect(factory({ optional: true }, ctx({ clinicId: null, user: { clinicId: null } }))).toBeNull();
  });
});

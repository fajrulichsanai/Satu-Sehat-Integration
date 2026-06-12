import { RolesGuard } from '../guards/roles.guard';
import { IsActiveGuard } from '../guards/is-active.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';

function mockContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const reflector = { getAllAndOverride: jest.fn() } as any;

  beforeEach(() => {
    guard = new RolesGuard(reflector);
    jest.clearAllMocks();
  });

  it('should allow access if no roles specified', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({ role: 'admin' }))).toBe(true);
  });

  it('should allow access if user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['owner']);
    expect(guard.canActivate(mockContext({ role: 'owner' }))).toBe(true);
  });

  it('should throw ForbiddenException if user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['owner']);
    expect(() => guard.canActivate(mockContext({ role: 'admin' }))).toThrow(ForbiddenException);
  });
});

describe('IsActiveGuard', () => {
  let guard: IsActiveGuard;

  beforeEach(() => {
    guard = new IsActiveGuard();
  });

  it('should throw if user is not active', () => {
    expect(() => guard.canActivate(mockContext({ isActive: false }))).toThrow();
  });

  it('should allow access if user is active', () => {
    expect(guard.canActivate(mockContext({ isActive: true }))).toBe(true);
  });

  it('should throw if no user in request', () => {
    expect(() => guard.canActivate(mockContext(null))).toThrow();
  });
});

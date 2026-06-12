import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get clinicId from request
 * Populated by ClinicContextGuard
 * 
 * Usage: @ClinicId() clinicId: number
 */
export const ClinicId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    return request.clinicId || request.user?.clinicId;
  },
);

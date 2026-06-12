import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get current user from request
 * Usage: @CurrentUser() user: JwtPayload
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

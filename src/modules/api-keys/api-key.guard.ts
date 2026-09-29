import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

/**
 * Authenticates /v1 requests by API key (X-Api-Key header, or
 * "Authorization: Bearer apx_..."), enforces the key's origin rules and the
 * clinic's plan limits, and exposes the remaining quota as response headers.
 * On success, request.apiClinicId holds the clinic the key belongs to.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const bearer: string | undefined = req.headers?.authorization;
    const rawKey: string | undefined =
      req.headers?.['x-api-key'] ??
      (bearer?.startsWith('Bearer apx_') ? bearer.slice(7) : undefined);

    const { apiKey, usage } = await this.apiKeysService.authenticate(rawKey, req.headers?.origin);

    res.setHeader('X-RateLimit-Limit', usage.limitPerMinute);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, usage.remainingThisMinute));
    res.setHeader('X-Quota-Limit', usage.limitPerDay);
    res.setHeader('X-Quota-Remaining', Math.max(0, usage.remainingToday));

    req.apiKey = apiKey;
    req.apiClinicId = apiKey.clinicId;
    return true;
  }
}

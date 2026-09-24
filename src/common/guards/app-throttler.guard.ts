import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
} from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Global rate limiter. Signed-in requests are counted per user, so a whole
 * clinic behind one NAT'd IP doesn't share a single bucket; anything else
 * (login, register, public booking, bad tokens) is counted per client IP.
 * The token is signature-checked here so a forged bearer header can't be
 * used to dodge the per-IP limits on the auth endpoints.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const header: string | undefined = req.headers?.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.verify<{ sub?: number; type?: string }>(
          header.slice(7),
        );
        if (payload?.sub && payload.type !== 'mfa_challenge') {
          return `user:${payload.sub}`;
        }
      } catch {
        // Invalid/expired token — fall through to the IP.
      }
    }
    return `ip:${req.ip}`;
  }
}

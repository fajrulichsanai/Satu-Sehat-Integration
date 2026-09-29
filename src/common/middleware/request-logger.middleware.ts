import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * One JSON line per API request on stdout, for the central log pipeline
 * (PM2 logs → Promtail/Loki, or any collector; see docs/LOGGING.md).
 * Records timestamp, endpoint, client identity and response status
 * (SATUSEHAT self-assessment No. 7, 15, 21). Deliberately never logs query
 * strings, bodies or headers other than the user agent: those carry patient
 * names, NIKs and tokens.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.LOG_HTTP === 'false') return next();

    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const user = (req as any).user;
      const line = {
        ts: new Date().toISOString(),
        type: 'http',
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - start) / 1e6,
        userId: user?.userId ?? null,
        role: user?.role ?? null,
        clinicId: user?.clinicId ?? null,
        impersonated: user?.impersonated || undefined,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.slice(0, 200),
      };
      process.stdout.write(JSON.stringify(line) + '\n');
    });
    next();
  }
}

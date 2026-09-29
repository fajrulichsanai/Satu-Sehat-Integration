import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind nginx and/or the Next.js BFF, req.ip would otherwise be the proxy's
  // address — which breaks per-IP rate limits and audit-log IPs. Only trust
  // X-Forwarded-For from the proxies named here (default: same host only).
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

  // Security headers (HSTS, nosniff, frame-ancestors, etc.). Swagger UI needs
  // inline scripts, so its route gets everything except the CSP.
  const helmetStrict = helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // clinic logos/images are embedded by the frontend origin
  });
  const helmetDocs = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  app.use((req: any, res: any, next: any) =>
    (req.path.startsWith('/api/docs') ? helmetDocs : helmetStrict)(req, res, next),
  );

  // API responses are per-user patient/financial data: never cache them in
  // browsers or proxies (stale screens, and PHI left on shared machines).
  // Public uploaded files under /files set their own long-lived caching.
  app.use((req: any, res: any, next: any) => {
    if (!req.path.startsWith('/files/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Uploaded files (payment proofs, supporting-exam images) are served through
  // authenticated, ownership-checked controller routes — see
  // SupportingExamController#getFile and SubscriptionPaymentsController#getProofFile —
  // never as unauthenticated static assets.

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert types automatically
      },
    }),
  );

  app.useGlobalFilters(
    new AllExceptionsFilter(), // Catch-all filter (must be first)
    new HttpExceptionFilter(), // HTTP exception filter
  );

  // CORS Configuration
  // FRONTEND_URL = dashboard ApexRecord, LANDING_PAGE_URL = website publik (booking reservasi)
  // Keduanya boleh berisi beberapa origin dipisah koma.
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.LANDING_PAGE_URL,
    'https://zanakdentalcare.web.app',
  ]
    .filter(Boolean)
    .flatMap((v) => v!.split(',').map((s) => s.trim()))
    .filter(Boolean);

  // The public API (/v1) is called from clinic websites on their own domains:
  // CORS lets any origin through, and ApiKeyGuard then checks the origin
  // against the key's registered domains. No cookies/credentials there.
  app.enableCors((req: any, callback: any) => {
    if (typeof req.url === 'string' && req.url.startsWith('/v1/')) {
      callback(null, {
        origin: true,
        credentials: false,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-Api-Key', 'Authorization'],
        exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Quota-Limit', 'X-Quota-Remaining'],
        maxAge: 86400,
      });
      return;
    }
    callback(null, {
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  });

  // Swagger/OpenAPI Documentation (Task 1.8)
  const config = new DocumentBuilder()
    .setTitle('ApexRecord API')
    .setDescription(
      'Sistem Manajemen Klinik Kesehatan dengan integrasi SATUSEHAT',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controllers!
    )
    .addTag('auth', 'Authentication & Authorization')
    .addTag('users', 'User Management')
    .addTag('settings', 'Clinic Settings & Configuration')
    .addTag('patients', 'Patient Management')
    .addTag(
      'reservations',
      'Reservation Management (Dashboard + Public Booking)',
    )
    .addTag('public', 'Public Endpoints (No Auth)')
    .addTag('encounters', 'Clinical Encounters')
    .addTag('diagnoses', 'Diagnosis Management')
    .addTag('procedures', 'Medical Procedures')
    .addTag('medications', 'Medication Management')
    .addTag('prescriptions', 'Prescription Management')
    .addTag('billing', 'Billing & Invoices')
    .addTag('reports', 'Reports & Analytics')
    .addTag('satusehat', 'SATUSEHAT Integration')
    .build();

  // API docs map every endpoint — off in production unless explicitly enabled.
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.SWAGGER_ENABLED !== 'false');
  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // Keep auth token in browser
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  }
}

/** TRUST_PROXY: a hop count ("1"), "true"/"false", or Express's named
 * subnets/IP list ("loopback", "loopback, 10.0.0.0/8"). */
function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (!value) return 'loopback';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  return value;
}
bootstrap();

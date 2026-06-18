import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // CORS Configuration (Task 1.9)
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*', // Configure in .env for production
    credentials: true,
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
    .addTag('queues', 'Queue Management')
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep auth token in browser
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();

import 'dotenv/config';
import { initTracing } from '@scheduler-platform/telemetry';

// Initialize OpenTelemetry SDK before loading Nest app modules
initTracing('api-gateway');

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as express from 'express';
import { GlobalExceptionFilter } from '@scheduler-platform/errors';
import { AppModule } from './app.module';
import { DocsService } from './docs/docs.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 1. Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permissive for interactive Swagger UI rendering
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. Request payload body limits (prevent payload bombing / DoS)
  app.use(express.json({ limit: process.env.REQUEST_SIZE_LIMIT || '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_SIZE_LIMIT || '1mb' }));

  // 3. CORS Policy Configuration
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : '*';

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-tenant-id',
      'x-request-id',
      'x-correlation-id',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'x-request-id',
    ],
    credentials: true,
  });

  // 4. OpenAPI / Swagger Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Distributed Task Scheduler API Gateway')
    .setDescription(
      'Unified Public API Gateway with JWT & API Key Auth, Rate Limiting, and Multi-tenancy',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const docsService = app.get(DocsService);
  docsService.setGatewayBaseDoc(document);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      urls: [
        { url: '/docs/spec/unified', name: '⚡ All Services (Unified)' },
        { url: '/docs/spec/identity', name: '🔐 Identity Service' },
        { url: '/docs/spec/scheduler', name: '⏱️ Scheduler Service' },
        { url: '/docs/spec/dispatcher', name: '🚀 Dispatcher Service' },
        { url: '/docs/spec/gateway', name: '🌐 Gateway Service' },
      ],
      'urls.primaryName': '⚡ All Services (Unified)',
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      persistAuthorization: true,
    },
  });

  const port = process.env.GATEWAY_PORT || 8080;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🚀 API Gateway running on: http://localhost:${port}`);
  logger.log(`📚 OpenAPI Docs available at: http://localhost:${port}/docs`);
}

bootstrap();

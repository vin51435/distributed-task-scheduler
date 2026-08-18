import 'dotenv/config';
import { initTracing } from '@scheduler-platform/telemetry';

// Initialize OpenTelemetry SDK before loading Nest app modules
initTracing('identity-service');

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '@scheduler-platform/errors';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Identity Service')
    .setDescription('Distributed Task Scheduler - Multi-tenant Identity & Access Management')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('tenants')
    .addTag('rbac')
    .addTag('api-keys')
    .addTag('health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(globalPrefix, app, document, {
    swaggerOptions: {
      displayRequestDuration: true,
    },
  });

  const port = process.env.IDENTITY_PORT || 3001;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🚀 Identity Service running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();

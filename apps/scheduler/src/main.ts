import 'dotenv/config';
import { initTracing } from '@scheduler-platform/telemetry';

// Initialize OpenTelemetry SDK before loading Nest app modules
initTracing('scheduler-service');

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

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
    .setTitle('Scheduler Service')
    .setDescription('Distributed Task Scheduler - Scheduler Service API')
    .setVersion('1.0.0')
    .addTag('schedules')
    .addTag('admin')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(globalPrefix, app, document, {
    swaggerOptions: {
      displayRequestDuration: true,
    },
  });

  const port = process.env.SCHEDULER_PORT || 3002;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🚀 Scheduler Service running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();

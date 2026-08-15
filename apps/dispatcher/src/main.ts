import 'dotenv/config';
import { initTracing } from '@scheduler-platform/telemetry';

// Initialize OpenTelemetry SDK before loading Nest app modules
initTracing('dispatcher-service');

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
    .setTitle('Dispatcher Service')
    .setDescription('Distributed Task Scheduler - Dispatcher Service Operational API')
    .setVersion('1.0.0')
    .addTag('dispatcher')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(globalPrefix, app, document, {
    swaggerOptions: {
      displayRequestDuration: true,
    },
  });

  const port = process.env.DISPATCHER_PORT || 3004;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`🚀 Dispatcher Service running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();

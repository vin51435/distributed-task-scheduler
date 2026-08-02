import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule, appConfigSchema } from '@scheduler/config';
import { AppLoggerModule } from '@scheduler/logger';
import { DatabaseModule, ScheduleEntity, JobEntity } from '@scheduler/database';
import { RabbitMQModule } from '@scheduler/rabbitmq';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule.forRoot(appConfigSchema),
    AppLoggerModule.forRoot({ serviceName: 'dispatcher-service' }),
    DatabaseModule.forRoot({
      entities: [ScheduleEntity, JobEntity],
    }),
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        urls: [configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672'],
        exchangeName: configService.get<string>('RABBITMQ_EXCHANGE') || 'scheduler.exchange',
        queueName: configService.get<string>('RABBITMQ_QUEUE') || 'scheduler.jobs',
        routingKey: configService.get<string>('RABBITMQ_ROUTING_KEY') || 'job.execute',
      }),
    }),
    DispatcherModule,
    HealthModule,
  ],
})
export class AppModule {}

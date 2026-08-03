import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule, appConfigSchema } from '@scheduler/config';
import { AppLoggerModule } from '@scheduler/logger';
import {
  DatabaseModule,
  ScheduleEntity,
  JobEntity,
  ExecutionEntity,
  JobAuditEntity,
} from '@scheduler/database';
import { RabbitMQModule } from '@scheduler/rabbitmq';
import { RedisModule } from '@scheduler/redis';
import { MetricsModule } from '@scheduler-platform/metrics';
import { ElasticsearchModule } from '@scheduler-platform/elasticsearch';
import { WorkerModule } from './worker/worker.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule.forRoot(appConfigSchema),
    AppLoggerModule.forRoot({ serviceName: 'worker-service' }),
    DatabaseModule.forRoot({
      entities: [ScheduleEntity, JobEntity, ExecutionEntity, JobAuditEntity],
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
    RedisModule,
    MetricsModule,
    ElasticsearchModule,
    WorkerModule,
    HealthModule,
  ],
})
export class AppModule {}

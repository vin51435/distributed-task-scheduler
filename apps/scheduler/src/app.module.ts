import { Module } from '@nestjs/common';
import { AppConfigModule, appConfigSchema } from '@scheduler/config';
import { AppLoggerModule } from '@scheduler/logger';
import {
  DatabaseModule,
  ScheduleEntity,
  JobEntity,
  ExecutionEntity,
  JobAuditEntity,
} from '@scheduler/database';
import { MetricsModule } from '@scheduler-platform/metrics';
import { ScheduleModule } from './schedule/schedule.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    AppConfigModule.forRoot(appConfigSchema),
    AppLoggerModule.forRoot({ serviceName: 'scheduler-service' }),
    DatabaseModule.forRoot({
      entities: [ScheduleEntity, JobEntity, ExecutionEntity, JobAuditEntity],
    }),
    MetricsModule,
    ScheduleModule,
    AdminModule,
  ],
})
export class AppModule {}

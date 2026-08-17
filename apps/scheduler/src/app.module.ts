import { Module } from '@nestjs/common';
import { AppConfigModule, appConfigSchema } from '@scheduler/config';
import { AppLoggerModule } from '@scheduler/logger';
import {
  DatabaseModule,
  ScheduleEntity,
  JobEntity,
  ExecutionEntity,
  JobAuditEntity,
  TenantLimitsEntity,
} from '@scheduler/database';
import { MetricsModule } from '@scheduler-platform/metrics';
import { ScheduleModule } from './schedule/schedule.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    AppConfigModule.forRoot(appConfigSchema),
    AppLoggerModule.forRoot({ serviceName: 'scheduler-service' }),
    DatabaseModule.forRoot({
      entities: [ScheduleEntity, JobEntity, ExecutionEntity, JobAuditEntity, TenantLimitsEntity],
    }),
    MetricsModule,
    ScheduleModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}

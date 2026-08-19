import { Module } from '@nestjs/common';
import { AppConfigModule, appConfigSchema } from '@scheduler-platform/config';
import { AppLoggerModule } from '@scheduler-platform/logger';
import {
  DatabaseModule,
  ScheduleEntity,
  JobEntity,
  ExecutionEntity,
  JobAuditEntity,
  TenantLimitsEntity,
} from '@scheduler-platform/database';
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

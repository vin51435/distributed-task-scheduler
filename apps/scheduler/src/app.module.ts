import { Module } from '@nestjs/common';
import { AppConfigModule, appConfigSchema } from '@scheduler/config';
import { AppLoggerModule } from '@scheduler/logger';
import { DatabaseModule, ScheduleEntity, JobEntity, ExecutionEntity } from '@scheduler/database';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [
    AppConfigModule.forRoot(appConfigSchema),
    AppLoggerModule.forRoot({ serviceName: 'scheduler-service' }),
    DatabaseModule.forRoot({
      entities: [ScheduleEntity, JobEntity, ExecutionEntity],
    }),
    ScheduleModule,
  ],
})
export class AppModule {}

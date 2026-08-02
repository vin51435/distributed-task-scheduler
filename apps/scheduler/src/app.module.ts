import { Module } from '@nestjs/common';
import { AppConfigModule, appConfigSchema } from '@scheduler/config';
import { AppLoggerModule } from '@scheduler/logger';
import { DatabaseModule } from '@scheduler/database';
import { ScheduleModule } from './schedule/schedule.module';
import { ScheduleEntity } from './schedule/entities/schedule.entity';

@Module({
  imports: [
    AppConfigModule.forRoot(appConfigSchema),
    AppLoggerModule.forRoot({ serviceName: 'scheduler-service' }),
    DatabaseModule.forRoot({
      entities: [ScheduleEntity],
    }),
    ScheduleModule,
  ],
})
export class AppModule {}

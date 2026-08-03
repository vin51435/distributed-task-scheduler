import { Module } from '@nestjs/common';
import { AppConfigModule, appConfigSchema } from '@scheduler/config';
import { AppLoggerModule } from '@scheduler/logger';
import { DatabaseModule, ScheduleEntity, JobEntity, ExecutionEntity } from '@scheduler/database';
import { RedisModule } from '@scheduler/redis';
import { ScannerModule } from './scanner/scanner.module';

@Module({
  imports: [
    AppConfigModule.forRoot(appConfigSchema),
    AppLoggerModule.forRoot({ serviceName: 'scanner-service' }),
    DatabaseModule.forRoot({
      entities: [ScheduleEntity, JobEntity, ExecutionEntity],
    }),
    RedisModule,
    ScannerModule,
  ],
})
export class AppModule {}

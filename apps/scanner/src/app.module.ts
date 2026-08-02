import { Module } from '@nestjs/common';
import { AppConfigModule, appConfigSchema } from '@scheduler/config';
import { AppLoggerModule } from '@scheduler/logger';
import { DatabaseModule, ScheduleEntity, JobEntity } from '@scheduler/database';
import { ScannerModule } from './scanner/scanner.module';

@Module({
  imports: [
    AppConfigModule.forRoot(appConfigSchema),
    AppLoggerModule.forRoot({ serviceName: 'scanner-service' }),
    DatabaseModule.forRoot({
      entities: [ScheduleEntity, JobEntity],
    }),
    ScannerModule,
  ],
})
export class AppModule {}

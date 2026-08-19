import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleEntity, JobEntity } from '@scheduler-platform/database';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScannerRepository } from './scanner.repository';
import { JobRepository } from '../job/job.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleEntity, JobEntity])],
  controllers: [ScannerController],
  providers: [ScannerService, ScannerRepository, JobRepository],
  exports: [ScannerService, ScannerRepository, JobRepository],
})
export class ScannerModule {}

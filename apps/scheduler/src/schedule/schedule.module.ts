import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleEntity, TenantLimitsEntity } from '@scheduler-platform/database';
import { ScheduleRepository } from './schedule.repository';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleEntity, TenantLimitsEntity])],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleRepository],
  exports: [ScheduleService, ScheduleRepository],
})
export class ScheduleModule {}

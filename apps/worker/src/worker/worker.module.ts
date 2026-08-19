import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionEntity, JobEntity, JobEffectEntity } from '@scheduler-platform/database';
import { HandlersModule } from '@scheduler-platform/handlers';
import { ExecutionRepository } from './execution.repository';
import { ExecutionService } from './execution.service';
import { ConsumerService } from './consumer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExecutionEntity, JobEntity, JobEffectEntity]),
    HandlersModule,
  ],
  providers: [ExecutionRepository, ExecutionService, ConsumerService],
  exports: [ExecutionService, HandlersModule],
})
export class WorkerModule {}

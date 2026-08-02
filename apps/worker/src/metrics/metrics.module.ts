import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { WorkerModule } from '../worker/worker.module';

@Module({
  imports: [WorkerModule],
  controllers: [MetricsController],
})
export class MetricsModule {}

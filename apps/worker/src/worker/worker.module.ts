import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionEntity, JobEntity } from '@scheduler/database';
import { EmailHandler } from './handlers/email.handler';
import { WebhookHandler } from './handlers/webhook.handler';
import { NoopHandler } from './handlers/noop.handler';
import { HandlerRegistry } from './handler.registry';
import { ExecutionRepository } from './execution.repository';
import { ExecutionService } from './execution.service';
import { ConsumerService } from './consumer.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExecutionEntity, JobEntity])],
  providers: [
    EmailHandler,
    WebhookHandler,
    NoopHandler,
    HandlerRegistry,
    ExecutionRepository,
    ExecutionService,
    ConsumerService,
  ],
  exports: [ExecutionService, HandlerRegistry],
})
export class WorkerModule {}

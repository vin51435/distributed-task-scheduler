import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConnectionService } from '@scheduler/rabbitmq';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { HandlerRegistry } from './handler.registry';
import { ExecutionService } from './execution.service';

export interface JobMessageEnvelope {
  jobId: string;
  scheduleId?: string;
  workerType?: string;
  routingKey?: string;
  priority?: number;
  tenantId?: string;
  executeAt?: string;
  payload?: Record<string, any>;
}

@Injectable()
export class ConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly handlerRegistry: HandlerRegistry,
    private readonly executionService: ExecutionService,
  ) {}

  onModuleInit() {
    this.startConsuming();
  }

  public startConsuming() {
    const channelWrapper = this.connectionService.getChannelWrapper();

    channelWrapper.addSetup(async (channel: ConfirmChannel) => {
      const exchangeName = process.env.RABBITMQ_EXCHANGE || 'scheduler.exchange';

      // Queues to consume for worker runtime
      const queueConfigs = [
        { name: 'worker.email', routingKey: 'worker.email' },
        { name: 'worker.webhook', routingKey: 'worker.webhook' },
        { name: 'worker.noop', routingKey: 'worker.noop' },
        { name: 'scheduler.jobs', routingKey: 'job.execute' },
      ];

      await channel.assertExchange(exchangeName, 'direct', { durable: true });

      for (const config of queueConfigs) {
        await channel.assertQueue(config.name, { durable: true });
        await channel.bindQueue(config.name, exchangeName, config.routingKey);

        this.logger.log(
          `Subscribing consumer to queue '${config.name}' bound to exchange '${exchangeName}' with routingKey '${config.routingKey}'`,
        );

        await channel.consume(config.name, async (msg: ConsumeMessage | null) => {
          if (msg) {
            await this.processMessage(channel, msg);
          }
        });
      }
    });
  }

  public async processMessage(channel: ConfirmChannel, msg: ConsumeMessage): Promise<void> {
    let envelope: JobMessageEnvelope;

    try {
      const contentStr = msg.content.toString();
      envelope = JSON.parse(contentStr);
    } catch (err: any) {
      this.logger.error(`Failed to parse RabbitMQ message JSON: ${err.message}`);
      channel.ack(msg);
      return;
    }

    if (!envelope || !envelope.jobId) {
      this.logger.warn('Received RabbitMQ message missing jobId property, dropping message');
      channel.ack(msg);
      return;
    }

    const workerType = envelope.workerType || 'EMAIL';
    this.logger.log(`Received message for Job ${envelope.jobId} (workerType: '${workerType}')`);

    let execution;
    try {
      execution = await this.executionService.startExecution(envelope.jobId);
    } catch (err: any) {
      this.logger.error(
        `Failed to start execution record for job ${envelope.jobId}: ${err.message}`,
      );
      channel.nack(msg, false, false);
      return;
    }

    try {
      const handler = this.handlerRegistry.getHandler(workerType);
      await handler.execute(envelope.payload || {});

      await this.executionService.completeExecution(execution.id, envelope.jobId);
      channel.ack(msg);
    } catch (err: any) {
      this.logger.error(
        `Error executing handler for job ${envelope.jobId}: ${err.message}`,
        err.stack,
      );
      await this.executionService.failExecution(execution.id, envelope.jobId, err.message);
      // ACK message as failure is persisted in execution table (retries handled in Phase 7)
      channel.ack(msg);
    }
  }
}

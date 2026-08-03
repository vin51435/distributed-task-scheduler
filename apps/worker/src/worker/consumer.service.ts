import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConnectionService, PublisherService, WORKER_QUEUE_CONFIGS } from '@scheduler/rabbitmq';
import { JobStatus, RetryPolicy } from '@scheduler/database';
import { calculateNextRetryAt, isRetryableError } from '@scheduler/errors';
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
export class ConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name);
  private isShuttingDown = false;

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly publisherService: PublisherService,
    private readonly handlerRegistry: HandlerRegistry,
    private readonly executionService: ExecutionService,
  ) {}

  onModuleInit() {
    this.startConsuming();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log(
      'Graceful shutdown initiated. Waiting for in-flight job executions to complete...',
    );

    const startTime = Date.now();
    const timeoutMs = 10000;

    while (this.executionService.getMetrics().activeExecutions > 0) {
      if (Date.now() - startTime > timeoutMs) {
        this.logger.warn(
          `Graceful shutdown timeout (${timeoutMs}ms) reached. Force closing worker consumer.`,
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.logger.log('Graceful shutdown complete. All active worker executions settled.');
  }

  public startConsuming() {
    const channelWrapper = this.connectionService.getChannelWrapper();

    channelWrapper.addSetup(async (channel: ConfirmChannel) => {
      const exchangeName = process.env.RABBITMQ_EXCHANGE || 'scheduler.exchange';

      const queueConfigs = WORKER_QUEUE_CONFIGS;

      await channel.assertExchange(exchangeName, 'direct', { durable: true });

      for (const config of queueConfigs) {
        // Assert primary queue and bind to exchange
        await channel.assertQueue(config.name, { durable: true });
        await channel.bindQueue(config.name, exchangeName, config.routingKey);

        // Assert Dead Letter Queue (DLQ) and bind to exchange
        await channel.assertQueue(config.dlqName, { durable: true });
        await channel.bindQueue(config.dlqName, exchangeName, config.dlqName);

        this.logger.log(
          `Subscribing consumer to queue '${config.name}' (DLQ: '${config.dlqName}') bound to exchange '${exchangeName}' with routingKey '${config.routingKey}'`,
        );

        await channel.consume(config.name, async (msg: ConsumeMessage | null) => {
          if (msg) {
            await this.processMessage(channel, msg, config.dlqName, exchangeName);
          }
        });
      }
    });
  }

  public async processMessage(
    channel: ConfirmChannel,
    msg: ConsumeMessage,
    dlqName: string,
    exchangeName: string,
  ): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Worker is shutting down. NACKing message to requeue.');
      channel.nack(msg, false, true);
      return;
    }

    let envelope: JobMessageEnvelope;
    const contentStr = msg.content.toString();

    // 1. Poison Message Detection (JSON Parsing)
    try {
      envelope = JSON.parse(contentStr);
    } catch (err: any) {
      this.logger.error(`Poison Message: Failed to parse RabbitMQ message JSON: ${err.message}`);
      await this.publishToDlq(exchangeName, dlqName, {
        jobId: 'unknown',
        reason: 'POISON_MESSAGE_MALFORMED_JSON',
        stackTrace: err.stack || err.message,
        attempt: 0,
        lastError: `JSON Parse Error: ${err.message}`,
        failedAt: new Date().toISOString(),
        rawContent: contentStr,
      });
      channel.ack(msg);
      return;
    }

    if (!envelope || !envelope.jobId) {
      this.logger.warn('Poison Message: Missing jobId property in payload');
      await this.publishToDlq(exchangeName, dlqName, {
        jobId: envelope?.jobId || 'missing',
        reason: 'POISON_MESSAGE_MISSING_JOB_ID',
        stackTrace: 'Message content lacked valid jobId field',
        attempt: 0,
        lastError: 'Missing jobId property',
        failedAt: new Date().toISOString(),
        payload: envelope || contentStr,
      });
      channel.ack(msg);
      return;
    }

    const workerType = envelope.workerType || 'EMAIL';
    this.logger.log(`Received message for Job ${envelope.jobId} (workerType: '${workerType}')`);

    // 2. Idempotency Check & Status Validation
    const existingJob = await this.executionService.findJobById(envelope.jobId);
    if (!existingJob) {
      this.logger.warn(`Job ${envelope.jobId} not found in database. Dropping message.`);
      channel.ack(msg);
      return;
    }

    if (
      existingJob.status === JobStatus.RUNNING ||
      existingJob.status === JobStatus.SUCCEEDED ||
      existingJob.status === JobStatus.DEAD
    ) {
      this.logger.warn(
        `Idempotency Guard: Job ${envelope.jobId} is currently in '${existingJob.status}' state. Skipping duplicate execution.`,
      );
      channel.ack(msg);
      return;
    }

    // 3. Start Execution Record
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

    const currentAttempt = (existingJob.attempt || 0) + 1;
    const maxAttempts = existingJob.maxAttempts || 5;
    const retryPolicy = existingJob.retryPolicy || RetryPolicy.EXPONENTIAL_BACKOFF;

    // 4. Run Job Handler Execution
    try {
      const handler = this.handlerRegistry.getHandler(workerType);
      await handler.execute(envelope.payload || {});

      await this.executionService.completeExecution(execution.id, envelope.jobId);
      channel.ack(msg);
    } catch (err: any) {
      const errorMessage = err.message || String(err);
      const stackTrace = err.stack;
      const retryable = isRetryableError(err);

      this.logger.error(
        `Error executing handler for job ${envelope.jobId} (attempt ${currentAttempt}/${maxAttempts}, retryable: ${retryable}): ${errorMessage}`,
        stackTrace,
      );

      if (!retryable || currentAttempt >= maxAttempts) {
        const failureReason = !retryable ? 'NON_RETRYABLE_ERROR' : 'EXHAUSTED_RETRIES';

        await this.executionService.failExecutionDead(
          execution.id,
          envelope.jobId,
          currentAttempt,
          errorMessage,
          stackTrace,
          failureReason,
        );

        await this.publishToDlq(exchangeName, dlqName, {
          jobId: envelope.jobId,
          scheduleId: envelope.scheduleId,
          workerType: workerType,
          routingKey: envelope.routingKey,
          reason: failureReason,
          stackTrace: stackTrace,
          attempt: currentAttempt,
          maxAttempts: maxAttempts,
          lastError: errorMessage,
          failedAt: new Date().toISOString(),
          payload: envelope.payload,
        });

        channel.ack(msg);
      } else {
        const nextRetryAt =
          calculateNextRetryAt(retryPolicy, currentAttempt) || new Date(Date.now() + 5000);

        await this.executionService.failExecutionWithRetry(
          execution.id,
          envelope.jobId,
          currentAttempt,
          nextRetryAt,
          errorMessage,
          stackTrace,
          'RETRYABLE_ERROR',
        );

        channel.ack(msg);
      }
    }
  }

  private async publishToDlq(
    exchange: string,
    dlqRoutingKey: string,
    dlqEnvelope: any,
  ): Promise<void> {
    try {
      await this.publisherService.publish(exchange, dlqRoutingKey, dlqEnvelope);
      this.logger.log(
        `Published dead-letter event to DLQ '${dlqRoutingKey}' for Job ${dlqEnvelope.jobId}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to publish message to DLQ queue '${dlqRoutingKey}': ${err.message}`,
        err.stack,
      );
    }
  }
}

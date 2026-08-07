import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConnectionService, PublisherService, WORKER_QUEUE_CONFIGS } from '@scheduler/rabbitmq';
import { JobStatus, RetryPolicy } from '@scheduler/database';
import { calculateNextRetryAt, isRetryableError } from '@scheduler/errors';
import { IdempotencyService, HeartbeatService, RateLimiterService } from '@scheduler/redis';
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
  private readonly instanceId = `worker-${randomUUID()}`;

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly publisherService: PublisherService,
    private readonly handlerRegistry: HandlerRegistry,
    private readonly executionService: ExecutionService,
    @Optional() private readonly idempotencyService?: IdempotencyService,
    @Optional() private readonly heartbeatService?: HeartbeatService,
    @Optional() private readonly rateLimiterService?: RateLimiterService,
  ) {}

  onModuleInit() {
    this.startConsuming();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log(
      `Worker [${this.instanceId}] graceful shutdown initiated. Waiting for in-flight job executions to complete...`,
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
        await channel.assertQueue(config.name, { durable: true });
        await channel.bindQueue(config.name, exchangeName, config.routingKey);

        await channel.assertQueue(config.dlqName, { durable: true });
        await channel.bindQueue(config.dlqName, exchangeName, config.dlqName);

        this.logger.log(
          `Worker [${this.instanceId}] consuming queue '${config.name}' (DLQ: '${config.dlqName}') bound to exchange '${exchangeName}' with routingKey '${config.routingKey}'`,
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
    this.logger.log(
      `Worker [${this.instanceId}] received message for Job ${envelope.jobId} (workerType: '${workerType}')`,
    );

    // 2. DB Status Validation & Idempotency (Primary Source of Truth)
    const existingJob = await this.executionService.findJobById(envelope.jobId);
    if (!existingJob) {
      this.logger.warn(`Job ${envelope.jobId} not found in database. Dropping message.`);
      channel.ack(msg);
      return;
    }

    if (existingJob.status === JobStatus.SUCCEEDED || existingJob.status === JobStatus.DEAD) {
      this.logger.warn(
        `Idempotency Guard (DB): Job ${envelope.jobId} is already in final '${existingJob.status}' state. Skipping execution.`,
      );
      channel.ack(msg);
      return;
    }

    // 3. Redis Fast Idempotency Check (Guard against active concurrent execution)
    if (this.idempotencyService && existingJob.status === JobStatus.RUNNING) {
      const isFirstTime = await this.idempotencyService.checkAndSet(
        `idempotency:worker:${envelope.jobId}`,
        86400,
      );
      if (!isFirstTime) {
        this.logger.warn(
          `Idempotency Guard (Redis): Job ${envelope.jobId} is currently running elsewhere. Skipping duplicate execution.`,
        );
        channel.ack(msg);
        return;
      }
    }

    // 4. Rate Limiting Check
    if (this.rateLimiterService) {
      const limit = workerType === 'EMAIL' ? 100 : workerType === 'WEBHOOK' ? 20 : 200;
      const fillRate = limit;
      const rateCheck = await this.rateLimiterService.consumeToken(
        `ratelimit:${workerType.toLowerCase()}`,
        limit,
        fillRate,
      );

      if (!rateCheck.allowed) {
        this.logger.warn(
          `Rate Limiter Guard: Rate limit exceeded for workerType '${workerType}'. Requeuing Job ${envelope.jobId}.`,
        );
        if (this.idempotencyService) {
          await this.idempotencyService.clear(`idempotency:worker:${envelope.jobId}`);
        }
        channel.nack(msg, false, true);
        return;
      }
    }

    // 5. Start Execution Record
    let execution;
    try {
      execution = await this.executionService.startExecution(envelope.jobId);
    } catch (err: any) {
      this.logger.error(
        `Failed to start execution record for job ${envelope.jobId}: ${err.message}`,
      );
      if (this.idempotencyService) {
        await this.idempotencyService.clear(`idempotency:worker:${envelope.jobId}`);
      }
      channel.nack(msg, false, false);
      return;
    }

    // 6. Start Heartbeat Timer
    let heartbeatTimer: NodeJS.Timeout | null = null;
    const heartbeatKey = `worker:job:${envelope.jobId}`;

    if (this.heartbeatService) {
      await this.heartbeatService.sendHeartbeat(heartbeatKey, this.instanceId, 15000);
      heartbeatTimer = setInterval(async () => {
        if (this.heartbeatService) {
          await this.heartbeatService.sendHeartbeat(heartbeatKey, this.instanceId, 15000);
        }
      }, 5000);
    }

    const currentAttempt = (existingJob.attempt || 0) + 1;
    const maxAttempts = existingJob.maxAttempts || 5;
    const retryPolicy = existingJob.retryPolicy || RetryPolicy.EXPONENTIAL_BACKOFF;

    // 7. Run Job Handler Execution
    try {
      const handler = this.handlerRegistry.getHandler(workerType);
      await handler.execute(envelope.payload || {}, envelope.jobId);

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

        // Clear Redis idempotency key so retry attempt can execute later
        if (this.idempotencyService) {
          await this.idempotencyService.clear(`idempotency:worker:${envelope.jobId}`);
        }

        channel.ack(msg);
      }
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (this.heartbeatService) {
        await this.heartbeatService.clearHeartbeat(heartbeatKey);
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

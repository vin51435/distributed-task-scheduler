import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { JobStatus } from '@scheduler/database';
import { PublisherService, WORKER_QUEUE_CONFIGS } from '@scheduler/rabbitmq';
import { LockService, IdempotencyService, HeartbeatService } from '@scheduler/redis';
import { DispatcherRepository } from './dispatcher.repository';

export interface DispatchResult {
  fetched: number;
  dispatched: number;
  failed: number;
}

export interface DispatcherMetrics {
  totalDispatched: number;
  totalFailed: number;
  lastDispatchTime: Date | null;
  pollingIntervalMs: number;
  batchSize: number;
  isPollingActive: boolean;
  instanceId: string;
}

@Injectable()
export class DispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private isDispatching = false;
  private isPollingActive = false;
  private totalDispatched = 0;
  private totalFailed = 0;
  private lastDispatchTime: Date | null = null;
  private pollingIntervalMs = 2000;
  private batchSize = 500;
  private exchangeName = 'scheduler.exchange';
  private routingKey = 'job.execute';
  private readonly instanceId: string;

  constructor(
    private readonly repository: DispatcherRepository,
    private readonly publisherService: PublisherService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly lockService?: LockService,
    @Optional() private readonly idempotencyService?: IdempotencyService,
    @Optional() private readonly heartbeatService?: HeartbeatService,
  ) {
    this.instanceId =
      this.configService?.get<string>('DISPATCHER_INSTANCE_ID') || `dispatcher-${randomUUID()}`;

    if (this.configService) {
      const interval = this.configService.get<number>('DISPATCHER_POLL_INTERVAL_MS');
      if (interval && !isNaN(Number(interval))) {
        this.pollingIntervalMs = Number(interval);
      }

      const batch = this.configService.get<number>('DISPATCHER_BATCH_SIZE');
      if (batch && !isNaN(Number(batch))) {
        this.batchSize = Number(batch);
      }

      const ex = this.configService.get<string>('RABBITMQ_EXCHANGE');
      if (ex) {
        this.exchangeName = ex;
      }

      const rk = this.configService.get<string>('RABBITMQ_ROUTING_KEY');
      if (rk) {
        this.routingKey = rk;
      }
    }
  }

  onModuleInit() {
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  public startPolling(intervalMs: number = this.pollingIntervalMs) {
    this.pollingIntervalMs = intervalMs;
    this.stopPolling();
    this.isPollingActive = true;
    this.runLoop();
    this.logger.log(
      `Dispatcher [${this.instanceId}] loop started with interval ${this.pollingIntervalMs}ms and batch size ${this.batchSize}`,
    );
  }

  public stopPolling() {
    this.isPollingActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.logger.log(`Dispatcher [${this.instanceId}] polling stopped`);
    }
  }

  private async runLoop() {
    if (!this.isPollingActive) return;

    try {
      if (this.heartbeatService) {
        await this.heartbeatService.sendHeartbeat(
          `dispatcher:instance:${this.instanceId}`,
          this.instanceId,
          15000,
        );
      }

      await this.dispatchBatch();
      await this.recoverStuckJobs();
    } catch (err: any) {
      this.logger.error(`Error during dispatcher automated loop: ${err.message}`, err.stack);
    } finally {
      if (this.isPollingActive) {
        this.timer = setTimeout(() => {
          this.runLoop();
        }, this.pollingIntervalMs);
      }
    }
  }

  async dispatchBatch(): Promise<DispatchResult> {
    if (this.isDispatching) {
      this.logger.warn('Dispatch batch already in progress, skipping iteration');
      return { fetched: 0, dispatched: 0, failed: 0 };
    }

    this.isDispatching = true;
    let dispatchedCount = 0;
    let failedCount = 0;

    try {
      const readyJobs = await this.repository.fetchAndClaimReadyJobs(this.batchSize);

      if (readyJobs.length > 0) {
        this.logger.log(
          `Dispatcher [${this.instanceId}] atomically claimed ${readyJobs.length} READY job(s) for dispatch`,
        );
      }

      for (const job of readyJobs) {
        if (!job || !job.id) {
          this.logger.warn('Claimed job missing id property. Skipping dispatch batch item.');
          continue;
        }

        // 1. Idempotency pre-check
        if (this.idempotencyService) {
          const isFirstTime = await this.idempotencyService.checkAndSet(
            `idempotency:dispatch:${job.id}`,
            86400,
          );
          if (!isFirstTime) {
            this.logger.warn(
              `Idempotency Guard: Job ${job.id} already dispatched previously. Skipping duplicate dispatch.`,
            );
            continue;
          }
        }

        // 2. Distributed Lock check
        const lockKey = `lock:job:dispatch:${job.id}`;
        let lockToken: string | null = null;
        if (this.lockService) {
          lockToken = await this.lockService.acquireLock(lockKey, 10000);
          if (!lockToken) {
            this.logger.warn(
              `Dispatch Lock: Job ${job.id} is locked by another dispatcher instance. Skipping.`,
            );
            continue;
          }
        }

        try {
          const knownWorkerRoutingKeys: string[] = WORKER_QUEUE_CONFIGS.map((c) => c.routingKey);
          let effectiveRoutingKey = job.routingKey;

          if (!effectiveRoutingKey && job.workerType) {
            const candidateKey = `worker.${job.workerType.toLowerCase()}`;
            if (knownWorkerRoutingKeys.includes(candidateKey)) {
              effectiveRoutingKey = candidateKey;
            }
          }

          if (!effectiveRoutingKey) {
            effectiveRoutingKey = this.routingKey;
          }

          const payloadEnvelope = {
            jobId: job.id,
            scheduleId: job.scheduleId,
            workerType: job.workerType,
            routingKey: effectiveRoutingKey,
            priority: job.priority || 0,
            tenantId: job.tenantId,
            executeAt: job.executeAt instanceof Date ? job.executeAt.toISOString() : job.executeAt,
            payload: job.payload,
          };

          await this.publisherService.publish(
            this.exchangeName,
            effectiveRoutingKey,
            payloadEnvelope,
          );

          dispatchedCount++;
          this.logger.log(
            `Job ${job.id} published to RabbitMQ exchange '${this.exchangeName}' with routingKey '${effectiveRoutingKey}' by ${this.instanceId}`,
          );
        } catch (err: any) {
          failedCount++;
          // Revert status to READY if RabbitMQ publish fails
          await this.repository.updateJobStatus(job.id, JobStatus.READY);
          if (this.idempotencyService) {
            await this.idempotencyService.clear(`idempotency:dispatch:${job.id}`);
          }
          this.logger.error(
            `Failed to publish job ${job.id} to RabbitMQ. Error: ${err.message}`,
            err.stack,
          );
        } finally {
          if (this.lockService && lockToken) {
            await this.lockService.releaseLock(lockKey, lockToken);
          }
        }
      }

      this.totalDispatched += dispatchedCount;
      this.totalFailed += failedCount;
      if (readyJobs.length > 0) {
        this.lastDispatchTime = new Date();
      }

      return {
        fetched: readyJobs.length,
        dispatched: dispatchedCount,
        failed: failedCount,
      };
    } finally {
      this.isDispatching = false;
    }
  }

  public async recoverStuckJobs(visibilityTimeoutMs = 60000): Promise<number> {
    try {
      const stuckJobs = await this.repository.findStuckJobs(visibilityTimeoutMs);
      let recoveredCount = 0;

      if (stuckJobs.length > 0) {
        this.logger.warn(
          `Found ${stuckJobs.length} stuck job(s) past visibility timeout. Checking worker heartbeats...`,
        );

        for (const job of stuckJobs) {
          // If Redis heartbeat service is available and job is RUNNING, check worker heartbeat
          if (this.heartbeatService && job.status === JobStatus.RUNNING) {
            const hasActiveWorkerHeartbeat = await this.heartbeatService.isAlive(
              `worker:job:${job.id}`,
            );
            if (hasActiveWorkerHeartbeat) {
              this.logger.log(
                `Job ${job.id} is still actively emitting worker heartbeat 'worker:job:${job.id}'. Skipping recovery.`,
              );
              continue;
            }
          }

          await this.repository.recoverStuckJob(
            job.id,
            `Visibility timeout (${visibilityTimeoutMs}ms) expired for job status ${job.status}`,
          );
          recoveredCount++;
        }
      }
      return recoveredCount;
    } catch (err: any) {
      this.logger.error(`Error recovering stuck jobs: ${err.message}`, err.stack);
      return 0;
    }
  }

  getMetrics(): DispatcherMetrics {
    return {
      totalDispatched: this.totalDispatched,
      totalFailed: this.totalFailed,
      lastDispatchTime: this.lastDispatchTime,
      pollingIntervalMs: this.pollingIntervalMs,
      batchSize: this.batchSize,
      isPollingActive: this.isPollingActive,
      instanceId: this.instanceId,
    };
  }
}

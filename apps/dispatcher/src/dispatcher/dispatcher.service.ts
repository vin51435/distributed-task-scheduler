import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobStatus } from '@scheduler/database';
import { PublisherService } from '@scheduler/rabbitmq';
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

  constructor(
    private readonly repository: DispatcherRepository,
    private readonly publisherService: PublisherService,
    @Optional() private readonly configService?: ConfigService,
  ) {
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
      `Dispatcher self-scheduling polling loop started with interval ${this.pollingIntervalMs}ms and batch size ${this.batchSize}`,
    );
  }

  public stopPolling() {
    this.isPollingActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.logger.log('Dispatcher polling stopped');
    }
  }

  private async runLoop() {
    if (!this.isPollingActive) return;

    try {
      await this.dispatchBatch();
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
      const waitingJobs = await this.repository.findWaitingJobs(this.batchSize);

      if (waitingJobs.length > 0) {
        this.logger.log(`Found ${waitingJobs.length} WAITING job(s) for dispatch`);
      }

      for (const job of waitingJobs) {
        try {
          const payloadEnvelope = {
            jobId: job.id,
            scheduleId: job.scheduleId,
            executeAt: job.executeAt instanceof Date ? job.executeAt.toISOString() : job.executeAt,
            payload: job.payload,
          };

          await this.publisherService.publish(this.exchangeName, this.routingKey, payloadEnvelope);

          await this.repository.updateJobStatus(job.id, JobStatus.DISPATCHED);
          dispatchedCount++;
          this.logger.log(`Job ${job.id} published to RabbitMQ and updated to DISPATCHED`);
        } catch (err: any) {
          failedCount++;
          this.logger.error(
            `Failed to publish job ${job.id} to RabbitMQ. Leaving status as WAITING. Error: ${err.message}`,
            err.stack,
          );
        }
      }

      this.totalDispatched += dispatchedCount;
      this.totalFailed += failedCount;
      if (waitingJobs.length > 0) {
        this.lastDispatchTime = new Date();
      }

      return {
        fetched: waitingJobs.length,
        dispatched: dispatchedCount,
        failed: failedCount,
      };
    } finally {
      this.isDispatching = false;
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
    };
  }
}

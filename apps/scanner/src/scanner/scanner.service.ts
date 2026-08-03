import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpressionParser } from 'cron-parser';
import { ScheduleStatus, ScheduleType, JobStatus } from '@scheduler/database';
import { ScannerRepository } from './scanner.repository';

export interface ScanResult {
  scannedSchedules: number;
  jobsCreated: number;
}

export interface ScannerMetrics {
  totalScans: number;
  jobsCreated: number;
  lastScanTime: Date | null;
  pollingIntervalMs: number;
  batchSize: number;
  isPollingActive: boolean;
}

@Injectable()
export class ScannerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScannerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isScanning = false;
  private isPollingActive = false;
  private totalScans = 0;
  private totalJobsCreated = 0;
  private lastScanTime: Date | null = null;
  private pollingIntervalMs = 5000;
  private batchSize = 500;

  constructor(
    private readonly repository: ScannerRepository,
    @Optional() private readonly configService?: ConfigService,
  ) {
    if (this.configService) {
      const configuredInterval = this.configService.get<number>('SCANNER_POLLING_INTERVAL_MS');
      if (configuredInterval && !isNaN(Number(configuredInterval))) {
        this.pollingIntervalMs = Number(configuredInterval);
      }

      const configuredBatchSize = this.configService.get<number>('SCANNER_BATCH_SIZE');
      if (configuredBatchSize && !isNaN(Number(configuredBatchSize))) {
        this.batchSize = Number(configuredBatchSize);
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
      `Scanner self-scheduling polling loop started with interval ${this.pollingIntervalMs}ms and batch size ${this.batchSize}`,
    );
  }

  public stopPolling() {
    this.isPollingActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.logger.log('Scanner polling stopped');
    }
  }

  private async runLoop() {
    if (!this.isPollingActive) return;

    try {
      await this.scan();
    } catch (err: any) {
      this.logger.error(`Error during automated scan loop: ${err.message}`, err.stack);
    } finally {
      if (this.isPollingActive) {
        this.timer = setTimeout(() => {
          this.runLoop();
        }, this.pollingIntervalMs);
      }
    }
  }

  async scan(now: Date = new Date()): Promise<ScanResult> {
    if (this.isScanning) {
      this.logger.warn('Scan already in progress, skipping iteration');
      return { scannedSchedules: 0, jobsCreated: 0 };
    }

    this.isScanning = true;
    let jobsCreatedCount = 0;

    try {
      const dueSchedules = await this.repository.findDueSchedules(now, this.batchSize);
      this.logger.log(`Found ${dueSchedules.length} due schedule(s) at ${now.toISOString()}`);

      for (const schedule of dueSchedules) {
        try {
          const executeAtTime = schedule.nextExecuteAt || now;

          await this.repository.createJob({
            scheduleId: schedule.id,
            status: JobStatus.READY,
            executeAt: executeAtTime,
            payload: schedule.payload,
            attempt: 0,
            maxAttempts: schedule.maxAttempts || 5,
            retryPolicy: schedule.retryPolicy,
            workerType: schedule.workerType,
            routingKey:
              schedule.routingKey ||
              (schedule.workerType ? `worker.${schedule.workerType.toLowerCase()}` : undefined),
            priority: schedule.priority || 0,
            tenantId: schedule.tenantId,
          });

          jobsCreatedCount++;

          if (schedule.type === ScheduleType.ONE_OFF) {
            await this.repository.updateSchedule(schedule.id, {
              status: ScheduleStatus.COMPLETED,
            });
          } else if (schedule.type === ScheduleType.CRON && schedule.cron) {
            const nextRunDate = this.calculateNextExecution(
              schedule.cron,
              schedule.timezone || 'UTC',
              executeAtTime,
            );
            await this.repository.updateSchedule(schedule.id, {
              nextExecuteAt: nextRunDate,
            });
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to process schedule ID ${schedule.id}: ${err.message}`,
            err.stack,
          );
        }
      }

      this.totalScans++;
      this.totalJobsCreated += jobsCreatedCount;
      this.lastScanTime = new Date();

      return {
        scannedSchedules: dueSchedules.length,
        jobsCreated: jobsCreatedCount,
      };
    } finally {
      this.isScanning = false;
    }
  }

  getMetrics(): ScannerMetrics {
    return {
      totalScans: this.totalScans,
      jobsCreated: this.totalJobsCreated,
      lastScanTime: this.lastScanTime,
      pollingIntervalMs: this.pollingIntervalMs,
      batchSize: this.batchSize,
      isPollingActive: this.isPollingActive,
    };
  }

  private calculateNextExecution(cron: string, timezone: string, currentDate: Date): Date {
    const interval = CronExpressionParser.parse(cron, {
      currentDate,
      tz: timezone,
    });
    return interval.next().toDate();
  }
}

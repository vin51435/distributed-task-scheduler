import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpressionParser } from 'cron-parser';
import { randomUUID } from 'crypto';
import { ScheduleStatus, ScheduleType, JobStatus } from '@scheduler/database';
import {
  LockService,
  LeaderElectionService,
  BucketService,
  HeartbeatService,
} from '@scheduler/redis';
import { MetricsService } from '@scheduler-platform/metrics';
import { ScannerRepository } from './scanner.repository';

export enum ScannerMode {
  LEADER = 'LEADER',
  BUCKET = 'BUCKET',
  STANDALONE = 'STANDALONE',
}

export interface ScanResult {
  scannedSchedules: number;
  jobsCreated: number;
  claimedBuckets?: number[];
  isLeader?: boolean;
}

export interface ScannerMetrics {
  totalScans: number;
  jobsCreated: number;
  lastScanTime: Date | null;
  pollingIntervalMs: number;
  batchSize: number;
  isPollingActive: boolean;
  instanceId: string;
  scannerMode: ScannerMode;
  isLeader?: boolean;
  claimedBuckets?: number[];
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
  private readonly instanceId: string;
  private scannerMode: ScannerMode = ScannerMode.BUCKET;
  private isLeader = false;
  private claimedBuckets: number[] = [];

  constructor(
    private readonly repository: ScannerRepository,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly lockService?: LockService,
    @Optional() private readonly leaderService?: LeaderElectionService,
    @Optional() private readonly bucketService?: BucketService,
    @Optional() private readonly heartbeatService?: HeartbeatService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {
    this.instanceId =
      this.configService?.get<string>('SCANNER_INSTANCE_ID') || `scanner-${randomUUID()}`;

    if (this.configService) {
      const configuredInterval = this.configService.get<number>('SCANNER_POLLING_INTERVAL_MS');
      if (configuredInterval && !isNaN(Number(configuredInterval))) {
        this.pollingIntervalMs = Number(configuredInterval);
      }

      const configuredBatchSize = this.configService.get<number>('SCANNER_BATCH_SIZE');
      if (configuredBatchSize && !isNaN(Number(configuredBatchSize))) {
        this.batchSize = Number(configuredBatchSize);
      }

      const mode = this.configService.get<string>('SCANNER_MODE');
      if (mode && Object.values(ScannerMode).includes(mode as ScannerMode)) {
        this.scannerMode = mode as ScannerMode;
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
      `Scanner [${this.instanceId}] loop started (mode: ${this.scannerMode}, interval: ${this.pollingIntervalMs}ms, batchSize: ${this.batchSize})`,
    );
  }

  public stopPolling() {
    this.isPollingActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.logger.log(`Scanner [${this.instanceId}] polling stopped`);
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
    let targetBuckets: number[] | undefined;

    try {
      // 1. Leader Election check if in LEADER mode
      if (this.scannerMode === ScannerMode.LEADER && this.leaderService) {
        const acquired = await this.leaderService.acquireLeadership(
          'scheduler:leader',
          this.instanceId,
          10,
        );

        if (!acquired) {
          const renewed = await this.leaderService.renewLeadership(
            'scheduler:leader',
            this.instanceId,
            10,
          );
          const wasLeader = this.isLeader;
          this.isLeader = renewed;
          if (wasLeader && !this.isLeader) {
            this.logger.warn(`[Leader Election] Instance ${this.instanceId} lost leadership!`);
          }
        } else {
          if (!this.isLeader) {
            this.logger.log(
              `[Leader Election] Instance ${this.instanceId} acquired leadership for 'scheduler:leader'`,
            );
          }
          this.isLeader = true;
        }

        if (!this.isLeader) {
          this.logger.log(
            `[Leader Guard] Instance ${this.instanceId} is follower. Skipping scan loop.`,
          );
          return { scannedSchedules: 0, jobsCreated: 0, isLeader: false };
        }

        if (this.heartbeatService) {
          await this.heartbeatService.sendHeartbeat('scanner:leader', this.instanceId, 10000);
        }
      }

      // Send instance heartbeat first so active scanner count is accurate
      if (this.heartbeatService) {
        await this.heartbeatService.sendHeartbeat(
          `scanner:instance:${this.instanceId}`,
          this.instanceId,
          15000,
        );
      }

      // 2. Bucketing check if in BUCKET mode
      if (this.scannerMode === ScannerMode.BUCKET && this.bucketService) {
        const activeInstances =
          (await this.bucketService.getActiveInstancesCount?.('scanner:instance:')) ?? 1;
        this.claimedBuckets = await this.bucketService.claimBuckets(
          60,
          this.instanceId,
          15000,
          activeInstances,
        );
        targetBuckets = this.claimedBuckets;

        if (targetBuckets.length === 0) {
          this.logger.debug(
            `[Bucket Guard] Instance ${this.instanceId} claimed 0 buckets. Skipping scan iteration.`,
          );
          return { scannedSchedules: 0, jobsCreated: 0, claimedBuckets: [] };
        }

        this.logger.debug(
          `[Bucket Lease] Instance ${this.instanceId} claimed ${targetBuckets.length} bucket(s) (active nodes: ${activeInstances})`,
        );
      }

      // 3. Query due schedules
      const dueSchedules = await this.repository.findDueSchedules(
        now,
        this.batchSize,
        targetBuckets,
      );

      if (dueSchedules.length > 0) {
        this.logger.log(
          `Instance ${this.instanceId} found ${dueSchedules.length} due schedule(s) at ${now.toISOString()}`,
        );
      } else {
        this.logger.debug(
          `Instance ${this.instanceId} found 0 due schedules at ${now.toISOString()}`,
        );
      }

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
            `Failed to promote schedule ${schedule.id} to job: ${err.message}`,
            err.stack,
          );
        }
      }

      this.totalScans++;
      this.totalJobsCreated += jobsCreatedCount;
      this.lastScanTime = new Date();

      if (jobsCreatedCount > 0) {
        this.metricsService?.scannerJobsCreatedTotal.inc(jobsCreatedCount);
      }
      this.metricsService?.scannerScanDuration.set((Date.now() - now.getTime()) / 1000);
      this.metricsService?.scannerBucketOwnership.set(this.claimedBuckets.length);

      return {
        scannedSchedules: dueSchedules.length,
        jobsCreated: jobsCreatedCount,
        claimedBuckets: this.claimedBuckets,
        isLeader: this.isLeader,
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
      instanceId: this.instanceId,
      scannerMode: this.scannerMode,
      isLeader: this.isLeader,
      claimedBuckets: this.claimedBuckets,
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

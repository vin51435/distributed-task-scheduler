import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: client.Registry;

  // Scheduler metrics
  public readonly schedulerRequestsTotal: client.Counter;
  public readonly schedulerActiveSchedules: client.Gauge;
  public readonly schedulerCreationLatency: client.Histogram;

  // Scanner metrics
  public readonly scannerScanDuration: client.Gauge;
  public readonly scannerJobsCreatedTotal: client.Counter;
  public readonly scannerBucketScanLatency: client.Gauge;
  public readonly scannerBucketOwnership: client.Gauge;

  // Dispatcher metrics
  public readonly dispatcherPublishTotal: client.Counter;
  public readonly dispatcherPublishFailuresTotal: client.Counter;
  public readonly dispatcherBatchSize: client.Gauge;
  public readonly dispatcherDispatchLatency: client.Gauge;

  // Worker metrics
  public readonly workerRunningJobs: client.Gauge;
  public readonly workerExecutionDuration: client.Histogram;
  public readonly workerSuccessTotal: client.Counter;
  public readonly workerFailureTotal: client.Counter;
  public readonly workerRetryTotal: client.Counter;
  public readonly workerDlqTotal: client.Counter;

  constructor() {
    this.registry = new client.Registry();
    client.collectDefaultMetrics({ register: this.registry });

    // Scheduler
    this.schedulerRequestsTotal = new client.Counter({
      name: 'scheduler_requests_total',
      help: 'Total number of schedule API requests',
      labelNames: ['method', 'status'],
      registers: [this.registry],
    });
    this.schedulerActiveSchedules = new client.Gauge({
      name: 'scheduler_active_schedules',
      help: 'Number of active schedules',
      registers: [this.registry],
    });
    this.schedulerCreationLatency = new client.Histogram({
      name: 'scheduler_schedule_creation_latency',
      help: 'Schedule creation latency in milliseconds',
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    // Scanner
    this.scannerScanDuration = new client.Gauge({
      name: 'scanner_scan_duration_seconds',
      help: 'Duration of scanner run in seconds',
      registers: [this.registry],
    });
    this.scannerJobsCreatedTotal = new client.Counter({
      name: 'scanner_jobs_created_total',
      help: 'Total jobs created by scanner',
      registers: [this.registry],
    });
    this.scannerBucketScanLatency = new client.Gauge({
      name: 'scanner_bucket_scan_latency',
      help: 'Latency of scanning a single bucket in ms',
      labelNames: ['bucket'],
      registers: [this.registry],
    });
    this.scannerBucketOwnership = new client.Gauge({
      name: 'scanner_bucket_ownership',
      help: 'Number of buckets currently owned by scanner node',
      registers: [this.registry],
    });

    // Dispatcher
    this.dispatcherPublishTotal = new client.Counter({
      name: 'dispatcher_publish_total',
      help: 'Total jobs published to RabbitMQ',
      registers: [this.registry],
    });
    this.dispatcherPublishFailuresTotal = new client.Counter({
      name: 'dispatcher_publish_failures_total',
      help: 'Total dispatch publish failures',
      registers: [this.registry],
    });
    this.dispatcherBatchSize = new client.Gauge({
      name: 'dispatcher_batch_size',
      help: 'Batch size of dispatched jobs',
      registers: [this.registry],
    });
    this.dispatcherDispatchLatency = new client.Gauge({
      name: 'dispatcher_dispatch_latency',
      help: 'Dispatch loop latency in milliseconds',
      registers: [this.registry],
    });

    // Worker
    this.workerRunningJobs = new client.Gauge({
      name: 'worker_running_jobs',
      help: 'Number of jobs currently running on worker',
      registers: [this.registry],
    });
    this.workerExecutionDuration = new client.Histogram({
      name: 'worker_execution_duration',
      help: 'Job execution duration in milliseconds',
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      registers: [this.registry],
    });
    this.workerSuccessTotal = new client.Counter({
      name: 'worker_success_total',
      help: 'Total successful job executions',
      labelNames: ['worker_type'],
      registers: [this.registry],
    });
    this.workerFailureTotal = new client.Counter({
      name: 'worker_failure_total',
      help: 'Total failed job executions',
      labelNames: ['worker_type'],
      registers: [this.registry],
    });
    this.workerRetryTotal = new client.Counter({
      name: 'worker_retry_total',
      help: 'Total job retries scheduled',
      registers: [this.registry],
    });
    this.workerDlqTotal = new client.Counter({
      name: 'worker_dlq_total',
      help: 'Total jobs moved to dead letter queue',
      registers: [this.registry],
    });
  }

  onModuleInit() {}

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}

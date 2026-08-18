import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum JobStatus {
  READY = 'READY',
  DISPATCHED = 'DISPATCHED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  DEAD = 'DEAD',
  CANCELLED = 'CANCELLED',
}

export enum RetryPolicy {
  NONE = 'NONE',
  FIXED_DELAY = 'FIXED_DELAY',
  LINEAR_BACKOFF = 'LINEAR_BACKOFF',
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF',
  JITTER = 'JITTER',
}

@Entity({ name: 'jobs' })
@Index('idx_jobs_dispatch', ['priority', 'executeAt'], { where: "status = 'READY'" })
@Index('idx_jobs_tenant_status', ['tenantId', 'status', 'createdAt'])
@Index('idx_jobs_schedule', ['scheduleId', 'status'])
export class JobEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'schedule_id' })
  scheduleId!: string;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.READY })
  status!: JobStatus;

  @Column({ type: 'timestamp with time zone', name: 'execute_at' })
  executeAt!: Date;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ type: 'integer', default: 0 })
  attempt!: number;

  @Column({ type: 'integer', default: 5, name: 'max_attempts' })
  maxAttempts?: number;

  @Column({
    type: 'enum',
    enum: RetryPolicy,
    default: RetryPolicy.EXPONENTIAL_BACKOFF,
    name: 'retry_policy',
  })
  retryPolicy?: RetryPolicy;

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'next_retry_at' })
  nextRetryAt?: Date | null;

  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError?: string | null;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'last_heartbeat' })
  lastHeartbeat?: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'worker_type' })
  workerType?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'routing_key' })
  routingKey?: string;

  @Column({ type: 'integer', default: 0 })
  priority?: number;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId?: string;
}

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { RetryPolicy } from './job.entity';

export enum ScheduleType {
  CRON = 'CRON',
  ONE_OFF = 'ONE_OFF',
}

export enum ScheduleStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
  ARCHIVED = 'ARCHIVED',
  COMPLETED = 'COMPLETED',
  WAITING = 'WAITING',
}

@Entity({ name: 'schedules' })
@Index('idx_schedules_due', ['bucket', 'nextExecuteAt'], { where: "status = 'ACTIVE'" })
@Index('idx_schedules_tenant_status', ['tenantId', 'status', 'createdAt'])
export class ScheduleEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ScheduleType, default: ScheduleType.CRON })
  type!: ScheduleType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cron?: string;

  @Column({ type: 'timestamp with time zone', name: 'next_execute_at', nullable: true })
  nextExecuteAt?: Date;

  @Column({ type: 'varchar', length: 100, default: 'UTC' })
  timezone!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ type: 'enum', enum: ScheduleStatus, default: ScheduleStatus.ACTIVE })
  status!: ScheduleStatus;

  @Column({ type: 'integer', default: 5, name: 'max_attempts' })
  maxAttempts?: number;

  @Column({
    type: 'enum',
    enum: RetryPolicy,
    default: RetryPolicy.EXPONENTIAL_BACKOFF,
    name: 'retry_policy',
  })
  retryPolicy?: RetryPolicy;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'worker_type' })
  workerType?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'routing_key' })
  routingKey?: string;

  @Column({ type: 'integer', default: 0 })
  priority?: number;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId?: string;

  @Column({ type: 'smallint', default: 0 })
  bucket?: number;
}

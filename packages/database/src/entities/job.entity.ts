import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum JobStatus {
  READY = 'READY',
  DISPATCHED = 'DISPATCHED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

@Entity({ name: 'jobs' })
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

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'worker_type' })
  workerType?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'routing_key' })
  routingKey?: string;

  @Column({ type: 'integer', default: 0 })
  priority?: number;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId?: string;
}

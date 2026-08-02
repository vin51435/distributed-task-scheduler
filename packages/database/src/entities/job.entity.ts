import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum JobStatus {
  WAITING = 'WAITING',
  DISPATCHED = 'DISPATCHED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

@Entity({ name: 'jobs' })
export class JobEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'schedule_id' })
  scheduleId!: string;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.WAITING })
  status!: JobStatus;

  @Column({ type: 'timestamp with time zone', name: 'execute_at' })
  executeAt!: Date;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ type: 'integer', default: 0 })
  attempt!: number;
}

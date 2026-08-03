import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum ExecutionStatus {
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

@Entity({ name: 'executions' })
export class ExecutionEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'job_id' })
  jobId!: string;

  @Column({ type: 'integer', default: 1, name: 'attempt_number' })
  attemptNumber!: number;

  @Column({ type: 'enum', enum: ExecutionStatus, default: ExecutionStatus.RUNNING })
  status!: ExecutionStatus;

  @Column({
    type: 'timestamp with time zone',
    name: 'started_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  startedAt!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'finished_at' })
  finishedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true, name: 'stack_trace' })
  stackTrace?: string;

  @Column({ type: 'integer', nullable: true, name: 'duration' })
  duration?: number;

  @Column({ type: 'integer', nullable: true, name: 'exit_code' })
  exitCode?: number;

  @Column({ type: 'integer', default: 1, name: 'retry_number' })
  retryNumber?: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'node_id' })
  nodeId?: string;
}

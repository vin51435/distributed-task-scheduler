import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { JobStatus } from './job.entity';

@Entity({ name: 'job_audit' })
export class JobAuditEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'job_id' })
  jobId!: string;

  @Column({ type: 'uuid', nullable: true, name: 'schedule_id' })
  scheduleId?: string;

  @Column({ type: 'enum', enum: JobStatus, name: 'previous_status', nullable: true })
  previousStatus?: JobStatus;

  @Column({ type: 'enum', enum: JobStatus, name: 'new_status' })
  newStatus!: JobStatus;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'actor_service' })
  actorService?: string;

  @Column({ type: 'text', nullable: true, name: 'reason' })
  reason?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}

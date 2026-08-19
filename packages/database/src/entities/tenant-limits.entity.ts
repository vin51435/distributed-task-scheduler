import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'tenant_limits' })
export class TenantLimitsEntity {
  @PrimaryColumn({ type: 'uuid', name: 'tenant_id' })
  @Index({ unique: true })
  tenantId!: string;

  @Column({ type: 'integer', default: 50, name: 'max_schedules' })
  maxSchedules!: number;

  @Column({ type: 'integer', default: 1000, name: 'max_jobs' })
  maxJobs!: number;

  @Column({ type: 'integer', default: 10, name: 'max_workers' })
  maxWorkers!: number;

  @Column({ type: 'integer', default: 300, name: 'max_requests_per_minute' })
  maxRequestsPerMinute!: number;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'updated_at',
  })
  updatedAt!: Date;
}

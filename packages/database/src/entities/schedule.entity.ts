import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum ScheduleType {
  CRON = 'CRON',
  ONE_OFF = 'ONE_OFF',
}

export enum ScheduleStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  WAITING = 'WAITING',
}

@Entity({ name: 'schedules' })
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

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'worker_type' })
  workerType?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'routing_key' })
  routingKey?: string;

  @Column({ type: 'integer', default: 0 })
  priority?: number;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId?: string;
}

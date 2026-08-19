import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

export enum TenantPlan {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

@Entity({ name: 'tenants' })
export class TenantEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ type: 'enum', enum: TenantPlan, default: TenantPlan.FREE })
  plan!: TenantPlan;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status!: TenantStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}

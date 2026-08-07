import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity({ name: 'job_effects' })
@Index(['jobId', 'effectType'])
export class JobEffectEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'job_id' })
  jobId!: string;

  @Column({ type: 'varchar', length: 100, name: 'effect_type' })
  effectType!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_id' })
  externalId?: string;

  @Column({ type: 'varchar', length: 50, default: 'SUCCESS' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}

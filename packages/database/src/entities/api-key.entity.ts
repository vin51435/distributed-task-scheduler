import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity({ name: 'api_keys' })
export class ApiKeyEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string; // e.g. 'Production Worker Key', 'CI Pipeline'

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'key_hash', unique: true })
  keyHash!: string;

  @Column({ type: 'varchar', length: 50, default: 'pts_live' })
  prefix!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions!: string[];

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'expires_at' })
  expiresAt?: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'last_used_at' })
  lastUsedAt?: Date | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;
}

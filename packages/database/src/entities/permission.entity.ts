import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity({ name: 'permissions' })
export class PermissionEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  action!: string; // e.g. 'schedules:create', 'jobs:retry'

  @Column({ type: 'varchar', length: 100 })
  resource!: string; // e.g. 'schedules', 'jobs', 'users'

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;
}

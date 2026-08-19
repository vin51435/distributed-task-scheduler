import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity({ name: 'roles' })
export class RoleEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId?: string | null; // Null indicates global/system roles (e.g. SUPERADMIN)

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;
}

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

@Entity({ name: 'refresh_tokens' })
export class RefreshTokenEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamp with time zone', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;
}

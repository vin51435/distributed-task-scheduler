import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface DatabaseConnectionOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  entities?: TypeOrmModuleOptions['entities'];
  synchronize?: boolean;
  poolMax?: number;
  poolMin?: number;
}

export function createTypeOrmConfig(options?: DatabaseConnectionOptions): TypeOrmModuleOptions {
  const poolMax = options?.poolMax || Number(process.env.DB_POOL_MAX) || 10;
  const poolMin = options?.poolMin || Number(process.env.DB_POOL_MIN) || 2;
  const idleTimeout = Number(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 30000;
  const connTimeout = Number(process.env.DB_POOL_CONN_TIMEOUT_MS) || 5000;

  return {
    type: 'postgres',
    host: options?.host || process.env.POSTGRES_HOST || 'localhost',
    port: options?.port || Number(process.env.POSTGRES_PORT) || 5432,
    username: options?.username || process.env.POSTGRES_USER || 'postgres',
    password: options?.password || process.env.POSTGRES_PASSWORD || 'postgres',
    database: options?.database || process.env.POSTGRES_DB || 'scheduler_db',
    entities: options?.entities || [],
    synchronize: options?.synchronize ?? process.env.NODE_ENV !== 'production',
    logging: process.env.DB_LOGGING === 'true' ? true : ['error', 'warn'],
    extra: {
      max: poolMax,
      min: poolMin,
      idleTimeoutMillis: idleTimeout,
      connectionTimeoutMillis: connTimeout,
    },
  };
}

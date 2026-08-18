import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface DatabaseConnectionOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  entities?: TypeOrmModuleOptions['entities'];
  synchronize?: boolean;
}

export function createTypeOrmConfig(options?: DatabaseConnectionOptions): TypeOrmModuleOptions {
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
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  };
}

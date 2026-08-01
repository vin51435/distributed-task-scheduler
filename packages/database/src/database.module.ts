import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface DatabaseConfigOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  entities?: TypeOrmModuleOptions['entities'];
  synchronize?: boolean;
}

@Module({})
export class DatabaseModule {
  static forRoot(options?: DatabaseConfigOptions): DynamicModule {
    const typeOrmOptions: TypeOrmModuleOptions = {
      type: 'postgres',
      host: options?.host || process.env.POSTGRES_HOST || 'localhost',
      port: options?.port || Number(process.env.POSTGRES_PORT) || 5432,
      username: options?.username || process.env.POSTGRES_USER || 'postgres',
      password: options?.password || process.env.POSTGRES_PASSWORD || 'postgres',
      database: options?.database || process.env.POSTGRES_DB || 'scheduler_db',
      entities: options?.entities || [],
      synchronize: options?.synchronize ?? process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    };

    return {
      module: DatabaseModule,
      imports: [TypeOrmModule.forRoot(typeOrmOptions)],
      exports: [TypeOrmModule],
    };
  }
}

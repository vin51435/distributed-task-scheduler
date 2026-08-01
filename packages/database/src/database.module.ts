import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createTypeOrmConfig, DatabaseConnectionOptions } from './typeorm.config';

@Module({})
export class DatabaseModule {
  static forRoot(options?: DatabaseConnectionOptions): DynamicModule {
    const config = createTypeOrmConfig(options);
    return {
      module: DatabaseModule,
      imports: [TypeOrmModule.forRoot(config)],
      exports: [TypeOrmModule],
    };
  }
}

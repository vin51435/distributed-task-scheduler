import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { z } from 'zod';
import { validateEnv } from './env.schema';

@Module({})
export class AppConfigModule {
  static forRoot<T extends z.ZodTypeAny>(schema: T): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          validate: (config: Record<string, unknown>) => validateEnv(schema, config),
        }),
      ],
      exports: [NestConfigModule],
    };
  }
}

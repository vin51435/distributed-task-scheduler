import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { z } from 'zod';

export function validateConfig<T extends z.ZodTypeAny>(
  schema: T,
  config: Record<string, unknown> = process.env,
): z.infer<T> {
  const result = schema.safeParse(config);
  if (!result.success) {
    const formattedErrors = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`❌ Invalid environment configuration:\n${formattedErrors}`);
  }
  return result.data;
}

@Module({})
export class AppConfigModule {
  static forRoot<T extends z.ZodTypeAny>(schema: T): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          validate: (config: Record<string, unknown>) => validateConfig(schema, config),
        }),
      ],
      exports: [NestConfigModule],
    };
  }
}

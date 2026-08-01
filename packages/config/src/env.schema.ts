import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type BaseEnvConfig = z.infer<typeof baseEnvSchema>;

export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  config: Record<string, unknown> = process.env,
): z.infer<T> {
  const result = schema.safeParse(config);
  if (!result.success) {
    const formattedErrors = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`❌ Invalid environment variables configuration:\n${formattedErrors}`);
  }
  return result.data;
}

import { z } from 'zod';

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  SCHEDULER_PORT: z.coerce.number().default(3001),
  SCANNER_PORT: z.coerce.number().default(3002),
  SCANNER_POLLING_INTERVAL_MS: z.coerce.number().default(5000),
  SCANNER_BATCH_SIZE: z.coerce.number().default(500),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

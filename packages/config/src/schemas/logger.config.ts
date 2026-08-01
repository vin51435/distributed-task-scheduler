import { z } from 'zod';

export const loggerConfigSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type LoggerConfig = z.infer<typeof loggerConfigSchema>;

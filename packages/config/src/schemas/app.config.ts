import { z } from 'zod';

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  SCHEDULER_PORT: z.coerce.number().default(3001),
  SCANNER_PORT: z.coerce.number().default(3002),
  SCANNER_POLLING_INTERVAL_MS: z.coerce.number().default(5000),
  SCANNER_BATCH_SIZE: z.coerce.number().default(500),
  DISPATCHER_PORT: z.coerce.number().default(3003),
  DISPATCHER_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  DISPATCHER_BATCH_SIZE: z.coerce.number().default(500),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().default('scheduler.exchange'),
  RABBITMQ_QUEUE: z.string().default('scheduler.jobs'),
  RABBITMQ_ROUTING_KEY: z.string().default('job.execute'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

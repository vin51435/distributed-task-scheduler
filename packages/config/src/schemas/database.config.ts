import { z } from 'zod';

export const databaseConfigSchema = z.object({
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default('postgres'),
  POSTGRES_DB: z.string().default('scheduler_db'),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

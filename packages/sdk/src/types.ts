export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  timeoutMs?: number;
}

export interface RegisterParams {
  organizationName: string;
  email: string;
  password: string;
  slug?: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface CreateScheduleParams {
  name: string;
  type: 'CRON' | 'ONE_OFF';
  cron?: string;
  executeAt?: string;
  payload: Record<string, any>;
  timezone?: string;
  workerType?: string;
  routingKey?: string;
  priority?: number;
  maxAttempts?: number;
  retryPolicy?: string;
  tenantId?: string;
}

export interface UpdateScheduleParams {
  name?: string;
  description?: string;
  type?: 'CRON' | 'ONE_OFF';
  cron?: string;
  executeAt?: string;
  payload?: Record<string, any>;
  timezone?: string;
  status?: string;
  priority?: number;
}

export interface JobSearchParams {
  status?: string;
  workerType?: string;
  tenantId?: string;
  createdAfter?: string;
  createdBefore?: string;
  page?: number;
  limit?: number;
}

export interface CreateApiKeyParams {
  name: string;
  permissions: string[];
  prefix?: string;
  expiresAt?: string;
}

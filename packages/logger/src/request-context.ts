import { AsyncLocalStorage } from 'async_hooks';
import * as os from 'os';

export interface RequestStore {
  correlationId?: string;
  requestId?: string;
  serviceName?: string;
  traceId?: string;
  jobId?: string;
  scheduleId?: string;
  executionId?: string;
  workerId?: string;
  bucket?: number;
  hostname?: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId;
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function getHostname(): string {
  return os.hostname();
}

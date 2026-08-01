import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  correlationId: string;
  requestId: string;
  serviceName: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId;
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

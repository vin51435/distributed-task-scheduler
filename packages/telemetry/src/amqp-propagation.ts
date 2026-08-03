import { context, propagation, Context } from '@opentelemetry/api';

export function injectTraceContext(headers: Record<string, any> = {}): Record<string, any> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return {
    ...headers,
    ...carrier,
  };
}

export function extractTraceContext(headers: Record<string, any> = {}): Context {
  const carrier: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      carrier[key] = value;
    }
  }
  return propagation.extract(context.active(), carrier);
}

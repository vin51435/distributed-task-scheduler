import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimitConfig';

export interface RateLimitOptions {
  capacity?: number;
  refillRate?: number;
  keyPrefix?: string;
  scope?: 'tenant' | 'user' | 'ip';
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

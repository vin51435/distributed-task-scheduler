import { RetryPolicy } from '@scheduler/database';
import { calculateNextRetryAt } from './retry-policy.calculator';

describe('calculateNextRetryAt', () => {
  const baseTime = new Date('2026-08-03T10:00:00.000Z');

  it('should return null for NONE policy', () => {
    const result = calculateNextRetryAt(RetryPolicy.NONE, 1, 5, baseTime);
    expect(result).toBeNull();
  });

  it('should calculate FIXED_DELAY correctly', () => {
    const result = calculateNextRetryAt(RetryPolicy.FIXED_DELAY, 1, 5, baseTime);
    expect(result?.toISOString()).toBe('2026-08-03T10:00:05.000Z');

    const result2 = calculateNextRetryAt(RetryPolicy.FIXED_DELAY, 3, 5, baseTime);
    expect(result2?.toISOString()).toBe('2026-08-03T10:00:05.000Z');
  });

  it('should calculate LINEAR_BACKOFF correctly', () => {
    const attempt1 = calculateNextRetryAt(RetryPolicy.LINEAR_BACKOFF, 1, 5, baseTime);
    expect(attempt1?.toISOString()).toBe('2026-08-03T10:00:05.000Z');

    const attempt2 = calculateNextRetryAt(RetryPolicy.LINEAR_BACKOFF, 2, 5, baseTime);
    expect(attempt2?.toISOString()).toBe('2026-08-03T10:00:10.000Z');

    const attempt3 = calculateNextRetryAt(RetryPolicy.LINEAR_BACKOFF, 3, 5, baseTime);
    expect(attempt3?.toISOString()).toBe('2026-08-03T10:00:15.000Z');
  });

  it('should calculate EXPONENTIAL_BACKOFF correctly', () => {
    const attempt1 = calculateNextRetryAt(RetryPolicy.EXPONENTIAL_BACKOFF, 1, 5, baseTime);
    expect(attempt1?.toISOString()).toBe('2026-08-03T10:00:05.000Z'); // 5 * 2^0 = 5s

    const attempt2 = calculateNextRetryAt(RetryPolicy.EXPONENTIAL_BACKOFF, 2, 5, baseTime);
    expect(attempt2?.toISOString()).toBe('2026-08-03T10:00:10.000Z'); // 5 * 2^1 = 10s

    const attempt3 = calculateNextRetryAt(RetryPolicy.EXPONENTIAL_BACKOFF, 3, 5, baseTime);
    expect(attempt3?.toISOString()).toBe('2026-08-03T10:00:20.000Z'); // 5 * 2^2 = 20s

    const attempt4 = calculateNextRetryAt(RetryPolicy.EXPONENTIAL_BACKOFF, 4, 5, baseTime);
    expect(attempt4?.toISOString()).toBe('2026-08-03T10:00:40.000Z'); // 5 * 2^3 = 40s
  });

  it('should calculate JITTER within expected bounds', () => {
    const result = calculateNextRetryAt(RetryPolicy.JITTER, 2, 5, baseTime);
    expect(result).not.toBeNull();
    const diffSeconds = (result!.getTime() - baseTime.getTime()) / 1000;
    // 5 * 2^1 = 10s base exp delay + random jitter (0-5s)
    expect(diffSeconds).toBeGreaterThanOrEqual(10);
    expect(diffSeconds).toBeLessThanOrEqual(15);
  });
});

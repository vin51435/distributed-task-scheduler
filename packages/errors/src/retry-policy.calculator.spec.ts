import { RetryPolicy, calculateNextRetryAt } from './retry-policy.calculator';

describe('calculateNextRetryAt', () => {
  const baseTime = new Date('2026-08-15T12:00:00.000Z');

  it('should return null when RetryPolicy is NONE', () => {
    const result = calculateNextRetryAt(RetryPolicy.NONE, 1, 5, baseTime);
    expect(result).toBeNull();
  });

  it('should calculate FIXED_DELAY correctly (constant 5 seconds)', () => {
    const result1 = calculateNextRetryAt(RetryPolicy.FIXED_DELAY, 1, 5, baseTime);
    const result2 = calculateNextRetryAt(RetryPolicy.FIXED_DELAY, 3, 5, baseTime);

    expect(result1?.toISOString()).toBe('2026-08-15T12:00:05.000Z');
    expect(result2?.toISOString()).toBe('2026-08-15T12:00:05.000Z');
  });

  it('should calculate LINEAR_BACKOFF correctly (baseDelay * attempt)', () => {
    const result1 = calculateNextRetryAt(RetryPolicy.LINEAR_BACKOFF, 1, 5, baseTime);
    const result2 = calculateNextRetryAt(RetryPolicy.LINEAR_BACKOFF, 2, 5, baseTime);
    const result3 = calculateNextRetryAt(RetryPolicy.LINEAR_BACKOFF, 3, 5, baseTime);

    expect(result1?.toISOString()).toBe('2026-08-15T12:00:05.000Z');
    expect(result2?.toISOString()).toBe('2026-08-15T12:00:10.000Z');
    expect(result3?.toISOString()).toBe('2026-08-15T12:00:15.000Z');
  });

  it('should calculate EXPONENTIAL_BACKOFF correctly (baseDelay * 2^(attempt - 1))', () => {
    const result1 = calculateNextRetryAt(RetryPolicy.EXPONENTIAL_BACKOFF, 1, 5, baseTime);
    const result2 = calculateNextRetryAt(RetryPolicy.EXPONENTIAL_BACKOFF, 2, 5, baseTime);
    const result3 = calculateNextRetryAt(RetryPolicy.EXPONENTIAL_BACKOFF, 3, 5, baseTime);
    const result4 = calculateNextRetryAt(RetryPolicy.EXPONENTIAL_BACKOFF, 4, 5, baseTime);

    expect(result1?.toISOString()).toBe('2026-08-15T12:00:05.000Z'); // 5 * 1
    expect(result2?.toISOString()).toBe('2026-08-15T12:00:10.000Z'); // 5 * 2
    expect(result3?.toISOString()).toBe('2026-08-15T12:00:20.000Z'); // 5 * 4
    expect(result4?.toISOString()).toBe('2026-08-15T12:00:40.000Z'); // 5 * 8
  });

  it('should calculate JITTER with a random variation on top of exponential delay', () => {
    const result = calculateNextRetryAt(RetryPolicy.JITTER, 2, 5, baseTime);
    expect(result).not.toBeNull();

    // Base exponential for attempt 2 is 10s. With jitter (0-5s), delay should be between 10s and 15s.
    const diffMs = result!.getTime() - baseTime.getTime();
    expect(diffMs).toBeGreaterThanOrEqual(10000);
    expect(diffMs).toBeLessThanOrEqual(15000);
  });
});

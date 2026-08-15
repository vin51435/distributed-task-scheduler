import { TokenBucketRateLimiterService } from './token-bucket.service';

describe('TokenBucketRateLimiterService', () => {
  let rateLimiter: TokenBucketRateLimiterService;

  beforeEach(() => {
    rateLimiter = new TokenBucketRateLimiterService();
  });

  it('should allow requests within burst capacity', async () => {
    const key = 'test-burst-key';
    const capacity = 5;
    const refillRate = 1;

    for (let i = 0; i < capacity; i++) {
      const res = await rateLimiter.consume(key, capacity, refillRate);
      expect(res.allowed).toBe(true);
      expect(res.remainingTokens).toBe(capacity - i - 1);
    }

    // 6th request should be blocked
    const blocked = await rateLimiter.consume(key, capacity, refillRate);
    expect(blocked.allowed).toBe(false);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('should refill tokens over time', async () => {
    const key = 'test-refill-key';
    const capacity = 2;
    const refillRate = 10; // 10 tokens per sec => 1 token every 100ms

    await rateLimiter.consume(key, capacity, refillRate, 2);
    const blocked = await rateLimiter.consume(key, capacity, refillRate, 1);
    expect(blocked.allowed).toBe(false);

    // Wait 150ms for refill
    await new Promise((resolve) => setTimeout(resolve, 150));

    const retry = await rateLimiter.consume(key, capacity, refillRate, 1);
    expect(retry.allowed).toBe(true);
  });
});

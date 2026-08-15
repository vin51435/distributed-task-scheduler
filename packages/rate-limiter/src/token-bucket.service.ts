import { Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  resetMs: number;
  totalLimit: number;
}

@Injectable()
export class TokenBucketRateLimiterService {
  private readonly logger = new Logger(TokenBucketRateLimiterService.name);
  private readonly memoryBuckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(@Optional() private readonly redisClient?: Redis) {}

  /**
   * Consumes a token using Redis Token Bucket or local Memory fallback.
   *
   * @param key Unique rate limit key (e.g. `ratelimit:tenant:abc`)
   * @param capacity Maximum tokens (burst limit)
   * @param refillRateTokensPerSec Token refill rate per second
   * @param tokensRequested Number of tokens to consume (default: 1)
   */
  public async consume(
    key: string,
    capacity: number,
    refillRateTokensPerSec: number,
    tokensRequested = 1,
  ): Promise<RateLimitResult> {
    if (this.redisClient && this.redisClient.status === 'ready') {
      return this.consumeRedis(key, capacity, refillRateTokensPerSec, tokensRequested);
    }
    return this.consumeMemory(key, capacity, refillRateTokensPerSec, tokensRequested);
  }

  private async consumeRedis(
    key: string,
    capacity: number,
    refillRate: number,
    requested: number,
  ): Promise<RateLimitResult> {
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local requested = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])

      local data = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(data[1])
      local last_refill = tonumber(data[2])

      if not tokens or not last_refill then
        tokens = capacity
        last_refill = now
      else
        local delta = math.max(0, now - last_refill) / 1000.0
        tokens = math.min(capacity, tokens + delta * refill_rate)
        last_refill = now
      end

      if tokens >= requested then
        tokens = tokens - requested
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
        local ttl = math.ceil(capacity / math.max(1, refill_rate)) * 2
        redis.call('EXPIRE', key, math.max(60, ttl))
        return {1, tokens, 0}
      else
        local missing = requested - tokens
        local wait_ms = math.ceil((missing / math.max(1, refill_rate)) * 1000)
        return {0, tokens, wait_ms}
      end
    `;

    try {
      const now = Date.now();
      const result: any = await this.redisClient!.eval(
        luaScript,
        1,
        key,
        capacity.toString(),
        refillRate.toString(),
        requested.toString(),
        now.toString(),
      );

      const allowed = result[0] === 1;
      const remainingTokens = Math.max(0, Math.floor(result[1]));
      const resetMs = result[2] || 0;

      return {
        allowed,
        remainingTokens,
        resetMs,
        totalLimit: capacity,
      };
    } catch (err: any) {
      this.logger.warn(`Redis rate limit error, falling back to memory: ${err.message}`);
      return this.consumeMemory(key, capacity, refillRate, requested);
    }
  }

  private consumeMemory(
    key: string,
    capacity: number,
    refillRate: number,
    requested: number,
  ): RateLimitResult {
    const now = Date.now();
    let bucket = this.memoryBuckets.get(key);

    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now };
      this.memoryBuckets.set(key, bucket);
    } else {
      const deltaSec = Math.max(0, now - bucket.lastRefill) / 1000.0;
      bucket.tokens = Math.min(capacity, bucket.tokens + deltaSec * refillRate);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= requested) {
      bucket.tokens -= requested;
      return {
        allowed: true,
        remainingTokens: Math.floor(bucket.tokens),
        resetMs: 0,
        totalLimit: capacity,
      };
    }

    const missing = requested - bucket.tokens;
    const resetMs = Math.ceil((missing / Math.max(1, refillRate)) * 1000);

    return {
      allowed: false,
      remainingTokens: Math.floor(bucket.tokens),
      resetMs,
      totalLimit: capacity,
    };
  }
}

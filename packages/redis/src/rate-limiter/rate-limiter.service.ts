import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Token Bucket rate limiter algorithm.
   * @param key Key for rate limit bucket (e.g., 'ratelimit:email')
   * @param capacity Max tokens bucket can hold (e.g., 100)
   * @param fillRate Tokens added per second (e.g., 100)
   * @param requested Tokens requested (default 1)
   */
  async consumeToken(
    key: string,
    capacity: number,
    fillRate: number,
    requested = 1,
  ): Promise<RateLimitResult> {
    const client = this.redisService.getClient();
    const now = Date.now() / 1000;

    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local fill_rate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local requested = tonumber(ARGV[4])

      local last_update = tonumber(redis.call("hget", key, "last_update"))
      local tokens = tonumber(redis.call("hget", key, "tokens"))

      if last_update == nil then
        tokens = capacity
        last_update = now
      else
        local delta = math.max(0, now - last_update)
        tokens = math.min(capacity, tokens + (delta * fill_rate))
        last_update = now
      end

      local allowed = 0
      if tokens >= requested then
        tokens = tokens - requested
        allowed = 1
      end

      redis.call("hset", key, "tokens", tokens)
      redis.call("hset", key, "last_update", last_update)
      redis.call("expire", key, 3600)

      return { allowed, math.floor(tokens) }
    `;

    try {
      const res = (await client.eval(
        luaScript,
        1,
        key,
        capacity.toString(),
        fillRate.toString(),
        now.toString(),
        requested.toString(),
      )) as [number, number];

      return {
        allowed: res[0] === 1,
        remaining: res[1],
      };
    } catch (err: any) {
      this.logger.error(`Rate limiter error for key '${key}': ${err.message}`, err.stack);
      // Fallback: allow request in case of Redis errors
      return { allowed: true, remaining: 0 };
    }
  }
}

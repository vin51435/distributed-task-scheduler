import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { randomUUID } from 'crypto';

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Attempts to acquire a lock for a given key and TTL.
   * Returns a lock token if acquired, or null if lock acquisition failed.
   */
  async acquireLock(key: string, ttlMs: number, value?: string): Promise<string | null> {
    const token = value || randomUUID();
    const client = this.redisService.getClient();

    try {
      // SET key value PX ttlMs NX
      const result = await client.set(key, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return token;
      }
      return null;
    } catch (err: any) {
      this.logger.error(`Failed to acquire lock for '${key}': ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Safely releases a lock using a Lua script to ensure token matches.
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    const client = this.redisService.getClient();
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const res = await client.eval(luaScript, 1, key, token);
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Failed to release lock for '${key}': ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Extends lock TTL if the current token matches.
   */
  async renewLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    const client = this.redisService.getClient();
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const res = await client.eval(luaScript, 1, key, token, ttlMs.toString());
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Failed to renew lock for '${key}': ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Helper to execute a function while holding a lock.
   */
  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
    const token = await this.acquireLock(key, ttlMs);
    if (!token) return null;

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, token);
    }
  }
}

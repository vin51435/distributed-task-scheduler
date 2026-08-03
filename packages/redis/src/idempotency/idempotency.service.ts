import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Atomically checks if a key exists. If not, sets it with TTL and returns true (first time execution).
   * If key already exists, returns false (duplicate execution).
   */
  async checkAndSet(key: string, ttlSeconds = 86400): Promise<boolean> {
    const client = this.redisService.getClient();

    try {
      const result = await client.set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err: any) {
      this.logger.error(`Error in idempotency checkAndSet for '${key}': ${err.message}`, err.stack);
      // Fallback: Return true to avoid blocking execution if Redis has a temporary glitch
      return true;
    }
  }

  /**
   * Checks if key exists in Redis.
   */
  async isProcessed(key: string): Promise<boolean> {
    const client = this.redisService.getClient();
    try {
      const exists = await client.exists(key);
      return exists === 1;
    } catch (err: any) {
      this.logger.error(
        `Error checking idempotency status for '${key}': ${err.message}`,
        err.stack,
      );
      return false;
    }
  }

  /**
   * Explicitly marks a key as processed.
   */
  async markProcessed(key: string, ttlSeconds = 86400): Promise<void> {
    const client = this.redisService.getClient();
    try {
      await client.set(key, '1', 'EX', ttlSeconds);
    } catch (err: any) {
      this.logger.error(`Error marking idempotency key '${key}': ${err.message}`, err.stack);
    }
  }

  /**
   * Removes idempotency key (e.g., if execution failed and needs to allow retry).
   */
  async clear(key: string): Promise<void> {
    const client = this.redisService.getClient();
    try {
      await client.del(key);
    } catch (err: any) {
      this.logger.error(`Error clearing idempotency key '${key}': ${err.message}`, err.stack);
    }
  }
}

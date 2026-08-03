import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';

@Injectable()
export class LeaderElectionService {
  private readonly logger = new Logger(LeaderElectionService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Attempts to acquire leadership key for a given identity.
   */
  async acquireLeadership(key: string, identity: string, ttlSeconds: number): Promise<boolean> {
    const client = this.redisService.getClient();

    try {
      const result = await client.set(key, identity, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err: any) {
      this.logger.error(`Failed to acquire leadership for key '${key}': ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Renews leadership key if current leader identity matches.
   */
  async renewLeadership(key: string, identity: string, ttlSeconds: number): Promise<boolean> {
    const client = this.redisService.getClient();
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const res = await client.eval(luaScript, 1, key, identity, ttlSeconds.toString());
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Failed to renew leadership for key '${key}': ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Releases leadership key if current identity matches.
   */
  async releaseLeadership(key: string, identity: string): Promise<boolean> {
    const client = this.redisService.getClient();
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const res = await client.eval(luaScript, 1, key, identity);
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Failed to release leadership for key '${key}': ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Returns current leader identity.
   */
  async getLeader(key: string): Promise<string | null> {
    const client = this.redisService.getClient();
    try {
      return await client.get(key);
    } catch (err: any) {
      this.logger.error(`Failed to fetch leader for key '${key}': ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Checks if current identity is leader.
   */
  async isLeader(key: string, identity: string): Promise<boolean> {
    const current = await this.getLeader(key);
    return current === identity;
  }
}

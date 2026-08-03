import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';

export interface HeartbeatPayload {
  identity: string;
  timestamp: number;
}

@Injectable()
export class HeartbeatService {
  private readonly logger = new Logger(HeartbeatService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Sends or updates a heartbeat for a key.
   */
  async sendHeartbeat(key: string, identity: string, ttlMs = 15000): Promise<void> {
    const client = this.redisService.getClient();
    const payload: HeartbeatPayload = {
      identity,
      timestamp: Date.now(),
    };

    try {
      await client.set(key, JSON.stringify(payload), 'PX', ttlMs);
    } catch (err: any) {
      this.logger.error(`Failed to send heartbeat for '${key}': ${err.message}`, err.stack);
    }
  }

  /**
   * Checks if heartbeat key exists in Redis.
   */
  async isAlive(key: string): Promise<boolean> {
    const client = this.redisService.getClient();
    try {
      const exists = await client.exists(key);
      return exists === 1;
    } catch (err: any) {
      this.logger.error(`Failed to check heartbeat for '${key}': ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Reads heartbeat details.
   */
  async getHeartbeat(key: string): Promise<HeartbeatPayload | null> {
    const client = this.redisService.getClient();
    try {
      const raw = await client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as HeartbeatPayload;
    } catch (err: any) {
      this.logger.error(`Failed to get heartbeat for '${key}': ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Clears a heartbeat key.
   */
  async clearHeartbeat(key: string): Promise<void> {
    const client = this.redisService.getClient();
    try {
      await client.del(key);
    } catch (err: any) {
      this.logger.error(`Failed to clear heartbeat for '${key}': ${err.message}`, err.stack);
    }
  }
}

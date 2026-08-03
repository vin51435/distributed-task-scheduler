import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';

export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

export function calculateBucket(keyOrId: string, numBuckets = 60): number {
  if (!keyOrId) return 0;
  return hashString(keyOrId) % numBuckets;
}

@Injectable()
export class BucketService {
  private readonly logger = new Logger(BucketService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Returns bucket index for a schedule ID or string key.
   */
  calculateBucket(keyOrId: string, numBuckets = 60): number {
    return calculateBucket(keyOrId, numBuckets);
  }

  /**
   * Returns count of active registered instances matching prefix.
   */
  async getActiveInstancesCount(servicePrefix = 'scanner:instance:'): Promise<number> {
    const client = this.redisService.getClient();
    try {
      const keys = await client.keys(`${servicePrefix}*`);
      return Math.max(1, keys.length);
    } catch (err: any) {
      this.logger.error(`Error fetching active instances count: ${err.message}`, err.stack);
      return 1;
    }
  }

  /**
   * Attempts to acquire lease on bucketId for given instance.
   */
  async acquireBucketLease(bucketId: number, instanceId: string, ttlMs = 15000): Promise<boolean> {
    const client = this.redisService.getClient();
    const key = `bucket:lease:${bucketId}`;

    try {
      const result = await client.set(key, instanceId, 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (err: any) {
      this.logger.error(`Error acquiring lease for bucket ${bucketId}: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Renews bucket lease if current owner matches instanceId.
   */
  async renewBucketLease(bucketId: number, instanceId: string, ttlMs = 15000): Promise<boolean> {
    const client = this.redisService.getClient();
    const key = `bucket:lease:${bucketId}`;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const res = await client.eval(luaScript, 1, key, instanceId, ttlMs.toString());
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Error renewing lease for bucket ${bucketId}: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Releases bucket lease if owner matches instanceId.
   */
  async releaseBucketLease(bucketId: number, instanceId: string): Promise<boolean> {
    const client = this.redisService.getClient();
    const key = `bucket:lease:${bucketId}`;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const res = await client.eval(luaScript, 1, key, instanceId);
      return res === 1;
    } catch (err: any) {
      this.logger.error(`Error releasing lease for bucket ${bucketId}: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Scans all buckets from 0 to totalBuckets - 1, attempting to acquire or renew lease for instanceId.
   * Supports cooperative fair-share quota rebalancing when multiple active instances are present.
   */
  async claimBuckets(
    totalBuckets = 60,
    instanceId: string,
    ttlMs = 15000,
    activeInstances = 1,
  ): Promise<number[]> {
    const maxQuota = Math.ceil(totalBuckets / Math.max(1, activeInstances));
    const claimed: number[] = [];

    for (let i = 0; i < totalBuckets; i++) {
      if (claimed.length >= maxQuota) {
        // If instance already reached fair share quota, release any excess bucket lease held
        await this.releaseBucketLease(i, instanceId);
        continue;
      }

      // First try to renew existing lease
      const renewed = await this.renewBucketLease(i, instanceId, ttlMs);
      if (renewed) {
        claimed.push(i);
      } else {
        // If not already owned by us, try to acquire lease
        const acquired = await this.acquireBucketLease(i, instanceId, ttlMs);
        if (acquired) {
          claimed.push(i);
        }
      }
    }

    return claimed;
  }
}

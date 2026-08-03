import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const host =
      this.configService?.get<string>('REDIS_HOST') || process.env.REDIS_HOST || 'localhost';
    const port = Number(
      this.configService?.get<number>('REDIS_PORT') || process.env.REDIS_PORT || 6379,
    );
    const password =
      this.configService?.get<string>('REDIS_PASSWORD') || process.env.REDIS_PASSWORD || undefined;
    const db = Number(this.configService?.get<number>('REDIS_DB') || process.env.REDIS_DB || 0);

    const options: RedisOptions = {
      host,
      port,
      password,
      db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    };

    this.client = new Redis(options);

    this.client.on('connect', () => {
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`, err.stack);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy() {
    try {
      if (this.client && this.client.status !== 'end') {
        this.logger.log('Disconnecting Redis client...');
        await this.client.quit();
      }
    } catch (err: any) {
      this.logger.warn(`Error disconnecting Redis client: ${err.message}`);
    }
  }
}

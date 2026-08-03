import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { LockService } from './lock/lock.service';
import { LeaderElectionService } from './leader-election/leader-election.service';
import { BucketService } from './bucket/bucket.service';
import { HeartbeatService } from './heartbeat/heartbeat.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { RateLimiterService } from './rate-limiter/rate-limiter.service';

@Global()
@Module({
  providers: [
    RedisService,
    LockService,
    LeaderElectionService,
    BucketService,
    HeartbeatService,
    IdempotencyService,
    RateLimiterService,
  ],
  exports: [
    RedisService,
    LockService,
    LeaderElectionService,
    BucketService,
    HeartbeatService,
    IdempotencyService,
    RateLimiterService,
  ],
})
export class RedisModule {}

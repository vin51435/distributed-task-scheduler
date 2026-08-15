import { Module, Global } from '@nestjs/common';
import { TokenBucketRateLimiterService } from './token-bucket.service';
import { RateLimiterGuard } from './rate-limiter.guard';

@Global()
@Module({
  providers: [TokenBucketRateLimiterService, RateLimiterGuard],
  exports: [TokenBucketRateLimiterService, RateLimiterGuard],
})
export class RateLimiterModule {}

import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TokenBucketRateLimiterService } from '@scheduler-platform/rate-limiter';

@Injectable()
export class GatewayRateLimitMiddleware implements NestMiddleware {
  constructor(private readonly rateLimiter: TokenBucketRateLimiterService) {}

  async use(req: Request & { tenantId?: string }, res: Response, next: NextFunction) {
    const rawPath = (req.originalUrl || req.url || req.path || '').toLowerCase();
    const path = rawPath.split('?')[0];
    if (
      path.startsWith('/health') ||
      path.startsWith('/docs') ||
      path.startsWith('/api-json') ||
      path.startsWith('/favicon.ico')
    ) {
      return next();
    }

    const scopeKey = req.tenantId || req.ip || req.socket.remoteAddress || 'anonymous';
    const rateKey = `ratelimit:gateway:${scopeKey}`;
    const capacity = req.tenantId ? 500 : 60; // 500 burst for authenticated tenants, 60 for unauthenticated
    const refillRate = req.tenantId ? 50 : 5; // 50 rps vs 5 rps

    const result = await this.rateLimiter.consume(rateKey, capacity, refillRate);

    res.setHeader('X-RateLimit-Limit', capacity.toString());
    res.setHeader('X-RateLimit-Remaining', result.remainingTokens.toString());
    res.setHeader('X-RateLimit-Reset-Ms', result.resetMs.toString());

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Gateway rate limit exceeded for ${scopeKey}. Please retry in ${Math.ceil(result.resetMs / 1000)}s`,
          retryAfterMs: result.resetMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}

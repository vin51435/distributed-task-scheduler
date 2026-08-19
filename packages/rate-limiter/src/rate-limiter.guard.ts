import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenBucketRateLimiterService } from './token-bucket.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiterService: TokenBucketRateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const tenantId = request.tenantId || request.user?.tenantId || 'global';
    const userId = request.user?.id || 'anonymous';
    const ip = request.ip || request.connection?.remoteAddress || '127.0.0.1';

    let scopeKey = tenantId;
    if (options.scope === 'user') scopeKey = `${tenantId}:${userId}`;
    if (options.scope === 'ip') scopeKey = ip;

    const rateKey = `ratelimit:${options.keyPrefix || 'http'}:${scopeKey}`;
    const capacity = options.capacity || 100;
    const refillRate = options.refillRate || 10;

    const result = await this.rateLimiterService.consume(rateKey, capacity, refillRate);

    if (response && response.setHeader) {
      response.setHeader('X-RateLimit-Limit', capacity.toString());
      response.setHeader('X-RateLimit-Remaining', result.remainingTokens.toString());
      response.setHeader('X-RateLimit-Reset-Ms', result.resetMs.toString());
    }

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded for scope ${scopeKey}. Please retry in ${Math.ceil(result.resetMs / 1000)}s`,
          retryAfterMs: result.resetMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

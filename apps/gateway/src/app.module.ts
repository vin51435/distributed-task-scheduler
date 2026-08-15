import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '@scheduler-platform/auth';
import { RateLimiterModule } from '@scheduler-platform/rate-limiter';
import { AppLoggerModule } from '@scheduler-platform/logger';
import { ProxyController } from './proxy/proxy.controller';
import { ProxyService } from './proxy/proxy.service';
import { HealthController } from './health/health.controller';
import { GatewayAuthMiddleware } from './middleware/gateway-auth.middleware';
import { GatewayRateLimitMiddleware } from './middleware/rate-limit.middleware';

@Module({
  imports: [AppLoggerModule.forRoot({ serviceName: 'api-gateway' }), AuthModule, RateLimiterModule],
  controllers: [ProxyController, HealthController],
  providers: [ProxyService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GatewayAuthMiddleware, GatewayRateLimitMiddleware).forRoutes('*');
  }
}

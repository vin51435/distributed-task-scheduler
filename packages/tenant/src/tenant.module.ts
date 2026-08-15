import { Module, Global } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantMiddleware } from './tenant.middleware';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [TenantContextService, TenantMiddleware, TenantInterceptor],
  exports: [TenantContextService, TenantMiddleware, TenantInterceptor],
})
export class TenantModule {}

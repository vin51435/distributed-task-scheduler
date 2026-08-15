import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UserEntity,
  TenantEntity,
  TenantLimitsEntity,
  RoleEntity,
  PermissionEntity,
  UserRoleEntity,
  RolePermissionEntity,
  RefreshTokenEntity,
  ApiKeyEntity,
  DatabaseModule,
} from '@scheduler/database';
import { AuthModule } from '@scheduler-platform/auth';
import { TenantModule } from '@scheduler-platform/tenant';
import { RateLimiterModule } from '@scheduler-platform/rate-limiter';
import { AppLoggerModule } from '@scheduler-platform/logger';
import { MetricsModule } from '@scheduler-platform/metrics';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { TenantsController } from './tenants/tenants.controller';
import { TenantsService } from './tenants/tenants.service';
import { RbacController } from './rbac/rbac.controller';
import { RbacService } from './rbac/rbac.service';
import { ApiKeysController } from './api-keys/api-keys.controller';
import { ApiKeysService } from './api-keys/api-keys.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    AppLoggerModule.forRoot({ serviceName: 'identity-service' }),
    DatabaseModule.forRoot({
      entities: [
        UserEntity,
        TenantEntity,
        TenantLimitsEntity,
        RoleEntity,
        PermissionEntity,
        UserRoleEntity,
        RolePermissionEntity,
        RefreshTokenEntity,
        ApiKeyEntity,
      ],
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      TenantEntity,
      TenantLimitsEntity,
      RoleEntity,
      PermissionEntity,
      UserRoleEntity,
      RolePermissionEntity,
      RefreshTokenEntity,
      ApiKeyEntity,
    ]),
    AuthModule,
    TenantModule,
    RateLimiterModule,
    MetricsModule,
  ],
  controllers: [
    AuthController,
    TenantsController,
    RbacController,
    ApiKeysController,
    HealthController,
  ],
  providers: [AuthService, TenantsService, RbacService, ApiKeysService],
})
export class AppModule {}

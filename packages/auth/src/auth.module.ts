import { Module, Global } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { ApiKeyService } from './api-key.service';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';

@Global()
@Module({
  providers: [JwtService, PasswordService, ApiKeyService, AuthGuard, RbacGuard],
  exports: [JwtService, PasswordService, ApiKeyService, AuthGuard, RbacGuard],
})
export class AuthModule {}

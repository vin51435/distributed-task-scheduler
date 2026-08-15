import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '../jwt.service';
import { IS_PUBLIC_KEY } from '../decorators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Check if x-api-key or x-tenant-id was forwarded by gateway
      const gatewayUserId = request.headers['x-user-id'];
      const gatewayTenantId = request.headers['x-tenant-id'];
      const gatewayRoles = request.headers['x-user-roles'];
      const gatewayPermissions = request.headers['x-user-permissions'];

      if (gatewayTenantId) {
        request.tenantId = gatewayTenantId;
        request.user = {
          id: gatewayUserId || 'service-user',
          tenantId: gatewayTenantId,
          roles: gatewayRoles ? gatewayRoles.split(',') : [],
          permissions: gatewayPermissions ? gatewayPermissions.split(',') : [],
        };
        return true;
      }

      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.substring(7);
    try {
      const payload = this.jwtService.verify(token);
      request.user = {
        id: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
      };
      request.tenantId = payload.tenantId;
      return true;
    } catch (err: any) {
      throw new UnauthorizedException(`Authentication failed: ${err.message}`);
    }
  }
}

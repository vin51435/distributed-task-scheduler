import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../decorators';
import { UserSession } from '../types';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as UserSession | undefined;

    if (!user) {
      throw new ForbiddenException('User context not available for authorization check');
    }

    const userRoles = (user.roles || []).map((r) => r.toUpperCase());
    const userPermissions = new Set(user.permissions || []);

    // Admins / Owners have superuser bypass
    if (userRoles.includes('ADMIN') || userRoles.includes('OWNER')) {
      return true;
    }

    // Role check if specified
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) => userRoles.includes(role.toUpperCase()));
      if (!hasRole) {
        throw new ForbiddenException(
          `User does not possess required role(s): ${requiredRoles.join(', ')}`,
        );
      }
    }

    // Permission check if specified
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every((perm) => userPermissions.has(perm));
      if (!hasPermission) {
        throw new ForbiddenException(
          `User lacks required permission(s): ${requiredPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}

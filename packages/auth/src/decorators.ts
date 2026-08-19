import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserSession } from './types';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (data: keyof UserSession | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    let user = request.user as UserSession | undefined;

    if (!user) {
      const headerUserId = request.headers['x-user-id'] as string;
      const headerTenantId = request.headers['x-tenant-id'] as string;
      const headerRoles = request.headers['x-user-roles'] as string;
      const headerPermissions = request.headers['x-user-permissions'] as string;

      if (headerUserId || headerTenantId) {
        user = {
          id: headerUserId || '',
          tenantId: headerTenantId || '',
          roles: headerRoles ? headerRoles.split(',') : [],
          permissions: headerPermissions ? headerPermissions.split(',') : [],
        };
        request.user = user;
      }
    }

    return data && user ? user[data] : user;
  },
);

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.tenantId ||
      (request.user && request.user.tenantId) ||
      (request.headers['x-tenant-id'] as string)
    );
  },
);

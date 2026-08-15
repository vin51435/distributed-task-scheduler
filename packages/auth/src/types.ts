export interface UserSession {
  id: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string; // User ID or API Key ID
  email?: string;
  tenantId: string;
  roles?: string[];
  permissions?: string[];
  type?: 'access' | 'refresh' | 'api_key';
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface ApiKeyPayload {
  id: string;
  name: string;
  tenantId: string;
  permissions: string[];
  prefix: string;
  expiresAt?: string | null;
}

export enum StandardRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export enum StandardPermission {
  // Schedules
  SCHEDULES_CREATE = 'schedules:create',
  SCHEDULES_READ = 'schedules:read',
  SCHEDULES_UPDATE = 'schedules:update',
  SCHEDULES_DELETE = 'schedules:delete',
  SCHEDULES_PAUSE = 'schedules:pause',
  SCHEDULES_RESUME = 'schedules:resume',

  // Jobs
  JOBS_CREATE = 'jobs:create',
  JOBS_READ = 'jobs:read',
  JOBS_CANCEL = 'jobs:cancel',
  JOBS_RETRY = 'jobs:retry',
  JOBS_REPLAY = 'jobs:replay',

  // Executions
  EXECUTIONS_READ = 'executions:read',

  // Audit
  AUDIT_READ = 'audit:read',

  // Admin & Users
  USERS_MANAGE = 'users:manage',
  ROLES_MANAGE = 'roles:manage',
  API_KEYS_MANAGE = 'api_keys:manage',
  TENANT_MANAGE = 'tenant:manage',
}

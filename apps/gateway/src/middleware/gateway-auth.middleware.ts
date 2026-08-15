import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import axios from 'axios';
import { JwtService } from '@scheduler-platform/auth';

@Injectable()
export class GatewayAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GatewayAuthMiddleware.name);
  private readonly identityUrl: string;

  constructor(private readonly jwtService: JwtService) {
    this.identityUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
  }

  async use(req: Request & { user?: any; tenantId?: string }, res: Response, next: NextFunction) {
    // 1. Generate / Propagate Correlation and Request IDs
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const correlationId = (req.headers['x-correlation-id'] as string) || requestId;

    req.headers['x-request-id'] = requestId;
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);

    // 2. Bypass public paths
    const rawPath = (req.originalUrl || req.url || req.path || '').toLowerCase();
    const path = rawPath.split('?')[0];
    if (
      path.startsWith('/health') ||
      path.startsWith('/docs') ||
      path.startsWith('/api-json') ||
      path.startsWith('/favicon.ico') ||
      path === '/api/auth/register' ||
      path === '/api/auth/login' ||
      path === '/api/auth/refresh' ||
      path === '/api/api-keys/validate'
    ) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'] as string;

    // 3. JWT Verification
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = this.jwtService.verify(token);
        req.user = {
          id: payload.sub,
          email: payload.email,
          tenantId: payload.tenantId,
          roles: payload.roles || [],
          permissions: payload.permissions || [],
        };
        req.tenantId = payload.tenantId;

        // Propagate headers to downstream services
        req.headers['x-user-id'] = payload.sub;
        req.headers['x-tenant-id'] = payload.tenantId;
        req.headers['x-user-roles'] = (payload.roles || []).join(',');
        req.headers['x-user-permissions'] = (payload.permissions || []).join(',');

        return next();
      } catch (err: any) {
        throw new UnauthorizedException(`Invalid or expired token: ${err.message}`);
      }
    }

    // 4. API Key Verification
    if (apiKeyHeader) {
      try {
        const validateRes = await axios.post(
          `${this.identityUrl}/api/api-keys/validate`,
          { rawKey: apiKeyHeader },
          { timeout: 3000 },
        );

        if (validateRes.data && validateRes.data.valid) {
          const keyData = validateRes.data;
          req.user = {
            id: keyData.id,
            name: keyData.name,
            tenantId: keyData.tenantId,
            roles: ['API_KEY'],
            permissions: keyData.permissions || [],
          };
          req.tenantId = keyData.tenantId;

          req.headers['x-user-id'] = keyData.id;
          req.headers['x-tenant-id'] = keyData.tenantId;
          req.headers['x-user-roles'] = 'API_KEY';
          req.headers['x-user-permissions'] = (keyData.permissions || []).join(',');

          return next();
        }
      } catch (err: any) {
        this.logger.warn(`API key validation failed: ${err.message}`);
        throw new UnauthorizedException('Invalid or inactive API Key');
      }
    }

    throw new UnauthorizedException('Authentication required: provide Bearer token or x-api-key');
  }
}

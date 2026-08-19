import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContextService: TenantContextService) {}

  use(req: Request & { tenantId?: string; user?: any }, res: Response, next: NextFunction) {
    const tenantId =
      (req.headers['x-tenant-id'] as string) || req.tenantId || req.user?.tenantId || 'default';

    const userId = (req.headers['x-user-id'] as string) || req.user?.id;
    const correlationId =
      (req.headers['x-correlation-id'] as string) || (req.headers['x-request-id'] as string);

    this.tenantContextService.runWithContext(
      {
        tenantId,
        userId,
        correlationId,
      },
      () => {
        req.tenantId = tenantId;
        next();
      },
    );
  }
}

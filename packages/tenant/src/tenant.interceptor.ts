import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId =
      (request.headers?.['x-tenant-id'] as string) ||
      request.tenantId ||
      request.user?.tenantId ||
      'default';

    const userId = (request.headers?.['x-user-id'] as string) || request.user?.id;
    const correlationId =
      (request.headers?.['x-correlation-id'] as string) ||
      (request.headers?.['x-request-id'] as string);

    return new Observable((observer) => {
      this.tenantContextService.runWithContext({ tenantId, userId, correlationId }, () => {
        request.tenantId = tenantId;
        next.handle().subscribe({
          next: (v) => observer.next(v),
          error: (e) => observer.error(e),
          complete: () => observer.complete(),
        });
      });
    });
  }
}

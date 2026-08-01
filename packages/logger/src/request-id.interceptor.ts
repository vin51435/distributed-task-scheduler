import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { getCorrelationId, getRequestId } from './request-context';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const response = http.getResponse();
    if (response && typeof response.setHeader === 'function') {
      const correlationId = getCorrelationId();
      const requestId = getRequestId();
      if (correlationId) response.setHeader('x-correlation-id', correlationId);
      if (requestId) response.setHeader('x-request-id', requestId);
    }
    return next.handle();
  }
}

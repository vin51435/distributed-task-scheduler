import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly serviceName: string = 'app') {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-correlation-id'] as string) || generateId();
    const requestId = (req.headers['x-request-id'] as string) || generateId();

    req.headers['x-correlation-id'] = correlationId;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-request-id', requestId);

    requestContext.run(
      {
        correlationId,
        requestId,
        serviceName: this.serviceName,
      },
      () => {
        next();
      },
    );
  }
}

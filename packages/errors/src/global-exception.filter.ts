import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let errorName: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message || exception.message;
        errorName = obj.error;
      }
    } else if (exception instanceof Error) {
      message = exception.message || 'Internal server error';
      errorName = exception.name;
    }

    const isDev = process.env.NODE_ENV !== 'production';

    const responseBody: Record<string, any> = {
      statusCode: status,
      message,
      ...(errorName && { error: errorName }),
      timestamp: new Date().toISOString(),
      path: request?.url,
    };

    // In development mode (NODE_ENV !== 'production'), attach stack trace and DB details
    if (isDev && exception instanceof Error) {
      responseBody.stack = exception.stack;

      const anyException = exception as any;
      if (anyException.query) {
        responseBody.query = anyException.query;
      }
      if (anyException.parameters) {
        responseBody.parameters = anyException.parameters;
      }
      if (anyException.detail) {
        responseBody.detail = anyException.detail;
      }
      if (anyException.driverError) {
        responseBody.driverError = {
          message: anyException.driverError.message,
          code: anyException.driverError.code,
          detail: anyException.driverError.detail,
          where: anyException.driverError.where,
          file: anyException.driverError.file,
          line: anyException.driverError.line,
          routine: anyException.driverError.routine,
        };
      }
    }

    if (status >= 500) {
      this.logger.error(
        `[${request?.method || 'UNKNOWN'}] ${request?.url || ''} -> ${status}: ${
          exception instanceof Error ? exception.message : JSON.stringify(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(responseBody);
  }
}

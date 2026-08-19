import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { requestContext, getHostname } from './request-context';

export interface AppLoggerModuleOptions {
  serviceName: string;
}

@Module({})
export class AppLoggerModule {
  static forRoot(options: AppLoggerModuleOptions): DynamicModule {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      module: AppLoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          pinoHttp: {
            name: options.serviceName,
            level: process.env.LOG_LEVEL || 'info',
            autoLogging: {
              ignore: (req) => {
                const url = (req.url || '').toLowerCase();
                return (
                  url.includes('/metrics') ||
                  url.includes('/health') ||
                  url.includes('/favicon.ico') ||
                  url.includes('/docs/swagger-ui') ||
                  url.includes('.js') ||
                  url.includes('.css')
                );
              },
            },
            serializers: {
              req: (req) => ({
                method: req.method,
                url: req.url,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
            },
            customSuccessMessage(req, res) {
              return `[${req.method}] ${req.url} -> ${res.statusCode}`;
            },
            customErrorMessage(req, res, err) {
              return `[${req.method}] ${req.url} -> ${res.statusCode} (Error: ${err.message})`;
            },
            mixin() {
              const store = requestContext.getStore();
              return {
                service: store?.serviceName || options.serviceName,
                hostname: store?.hostname || getHostname(),
                correlationId: store?.correlationId,
                requestId: store?.requestId,
                traceId: store?.traceId,
                jobId: store?.jobId,
                scheduleId: store?.scheduleId,
                executionId: store?.executionId,
                workerId: store?.workerId,
                bucket: store?.bucket,
              };
            },
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    ignore: 'pid,hostname,req,res,responseTime,trace_id,span_id,trace_flags',
                    translateTime: 'HH:MM:ss',
                  },
                },
          },
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}

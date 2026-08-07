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
                  },
                },
          },
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}

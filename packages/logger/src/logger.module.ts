import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { requestContext } from './request-context';

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
                correlationId: store?.correlationId,
                requestId: store?.requestId,
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

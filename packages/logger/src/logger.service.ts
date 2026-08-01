import pino from 'pino';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
  isProduction?: boolean;
}

export function createLogger(options: LoggerOptions) {
  const isProd = options.isProduction ?? process.env.NODE_ENV === 'production';
  return pino({
    name: options.serviceName,
    level: options.level || process.env.LOG_LEVEL || 'info',
    transport: isProd
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          },
        },
  });
}

export type Logger = ReturnType<typeof createLogger>;

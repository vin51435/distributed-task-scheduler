import { z } from 'zod';
import { validateConfig, AppConfigModule } from './config.module';
import { validateEnv, baseEnvSchema } from './env.schema';
import { appConfigSchema } from './schemas/app.config';
import { databaseConfigSchema } from './schemas/database.config';
import { loggerConfigSchema } from './schemas/logger.config';

describe('Config Module with Zod v4', () => {
  describe('validateConfig', () => {
    it('should validate and parse configuration matching appConfigSchema', () => {
      const config = {
        NODE_ENV: 'test',
        PORT: '4000',
        RABBITMQ_URL: 'amqp://localhost:5672',
      };
      const validated = validateConfig(appConfigSchema, config);
      expect(validated.NODE_ENV).toBe('test');
      expect(validated.PORT).toBe(4000);
      expect(validated.RABBITMQ_URL).toBe('amqp://localhost:5672');
    });

    it('should throw error for invalid values', () => {
      const config = {
        NODE_ENV: 'invalid_env',
      };
      expect(() => validateConfig(appConfigSchema, config)).toThrow(
        'Invalid environment configuration',
      );
    });
  });

  describe('validateEnv', () => {
    it('should validate baseEnvSchema with defaults', () => {
      const validated = validateEnv(baseEnvSchema, {});
      expect(validated.NODE_ENV).toBe('development');
      expect(validated.PORT).toBe(3000);
      expect(validated.LOG_LEVEL).toBe('info');
    });
  });

  describe('Schemas', () => {
    it('should validate databaseConfigSchema', () => {
      const validated = validateConfig(databaseConfigSchema, {
        POSTGRES_PORT: '5433',
      });
      expect(validated.POSTGRES_PORT).toBe(5433);
      expect(validated.POSTGRES_HOST).toBe('localhost');
    });

    it('should validate loggerConfigSchema', () => {
      const validated = validateConfig(loggerConfigSchema, {
        LOG_LEVEL: 'debug',
      });
      expect(validated.LOG_LEVEL).toBe('debug');
    });
  });

  describe('AppConfigModule', () => {
    it('should create dynamic module for schema', () => {
      const dynamicModule = AppConfigModule.forRoot(appConfigSchema);
      expect(dynamicModule.module).toBe(AppConfigModule);
      expect(dynamicModule.imports).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });
  });
});

import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { RabbitMQModuleOptions, RABBITMQ_MODULE_OPTIONS } from './config';
import { ConnectionService } from './connection.service';
import { PublisherService } from './publisher.service';
import { ExchangeService } from './exchange';
import { QueueService } from './queue';

@Global()
@Module({})
export class RabbitMQModule {
  static forRoot(options: RabbitMQModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: RABBITMQ_MODULE_OPTIONS,
      useValue: options,
    };

    return {
      module: RabbitMQModule,
      providers: [
        optionsProvider,
        ConnectionService,
        PublisherService,
        ExchangeService,
        QueueService,
      ],
      exports: [ConnectionService, PublisherService, ExchangeService, QueueService],
    };
  }

  static forRootAsync(asyncOptions: {
    useFactory: (...args: any[]) => Promise<RabbitMQModuleOptions> | RabbitMQModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const optionsProvider: Provider = {
      provide: RABBITMQ_MODULE_OPTIONS,
      useFactory: asyncOptions.useFactory,
      inject: asyncOptions.inject || [],
    };

    return {
      module: RabbitMQModule,
      providers: [
        optionsProvider,
        ConnectionService,
        PublisherService,
        ExchangeService,
        QueueService,
      ],
      exports: [ConnectionService, PublisherService, ExchangeService, QueueService],
    };
  }
}

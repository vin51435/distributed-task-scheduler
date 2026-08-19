import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { RabbitMQModuleOptions, RABBITMQ_MODULE_OPTIONS } from './config';
import { WORKER_QUEUE_CONFIGS } from './constants';

@Injectable()
export class ConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionService.name);
  private connectionManager: AmqpConnectionManager | null = null;
  private confirmChannelWrapper: ChannelWrapper | null = null;
  private isConnected = false;

  constructor(@Inject(RABBITMQ_MODULE_OPTIONS) private readonly options: RabbitMQModuleOptions) {}

  onModuleInit() {
    this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  public connect(): void {
    if (this.connectionManager) return;

    this.logger.log(`Connecting to RabbitMQ cluster at ${this.options.urls.join(', ')}...`);

    this.connectionManager = amqp.connect(this.options.urls, {
      heartbeatIntervalInSeconds: this.options.heartbeatIntervalInSeconds || 5,
      reconnectTimeInSeconds: this.options.reconnectTimeInSeconds || 2,
    });

    this.connectionManager.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Successfully connected to RabbitMQ broker');
    });

    this.connectionManager.on('disconnect', (err) => {
      this.isConnected = false;
      this.logger.warn(`Disconnected from RabbitMQ broker: ${err.err?.message || err}`);
    });

    const exchangeName = this.options.exchangeName || 'scheduler.exchange';
    this.confirmChannelWrapper = this.connectionManager.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        this.logger.log(`Initializing RabbitMQ topology for exchange='${exchangeName}'`);
        await channel.assertExchange(exchangeName, 'direct', { durable: true });

        for (const config of WORKER_QUEUE_CONFIGS) {
          await channel.assertQueue(config.name, { durable: true });
          await channel.bindQueue(config.name, exchangeName, config.routingKey);
          await channel.assertQueue(config.dlqName, { durable: true });
          await channel.bindQueue(config.dlqName, exchangeName, config.dlqName);
        }
      },
    });
  }

  public async disconnect(): Promise<void> {
    if (this.confirmChannelWrapper) {
      await this.confirmChannelWrapper.close();
      this.confirmChannelWrapper = null;
    }
    if (this.connectionManager) {
      await this.connectionManager.close();
      this.connectionManager = null;
    }
    this.isConnected = false;
    this.logger.log('Closed RabbitMQ connection manager');
  }

  public getChannelWrapper(): ChannelWrapper {
    if (!this.confirmChannelWrapper) {
      this.connect();
    }
    return this.confirmChannelWrapper!;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

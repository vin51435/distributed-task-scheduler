import { Injectable, Logger } from '@nestjs/common';
import { ConnectionService } from './connection.service';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly connectionService: ConnectionService) {}

  async assertQueue(name: string, options = { durable: true }): Promise<void> {
    const channelWrapper = this.connectionService.getChannelWrapper();
    await channelWrapper.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertQueue(name, options);
      this.logger.log(`Queue '${name}' asserted`);
    });
  }

  async bindQueue(queue: string, exchange: string, routingKey: string): Promise<void> {
    const channelWrapper = this.connectionService.getChannelWrapper();
    await channelWrapper.addSetup(async (channel: ConfirmChannel) => {
      await channel.bindQueue(queue, exchange, routingKey);
      this.logger.log(`Queue '${queue}' bound to exchange '${exchange}' with key '${routingKey}'`);
    });
  }
}

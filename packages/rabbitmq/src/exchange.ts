import { Injectable, Logger } from '@nestjs/common';
import { ConnectionService } from './connection.service';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class ExchangeService {
  private readonly logger = new Logger(ExchangeService.name);

  constructor(private readonly connectionService: ConnectionService) {}

  async assertExchange(
    name: string,
    type: 'direct' | 'fanout' | 'topic' | 'headers' = 'direct',
    options = { durable: true },
  ): Promise<void> {
    const channelWrapper = this.connectionService.getChannelWrapper();
    await channelWrapper.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertExchange(name, type, options);
      this.logger.log(`Exchange '${name}' (${type}) asserted`);
    });
  }
}

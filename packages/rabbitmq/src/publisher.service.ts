import { Injectable, Logger } from '@nestjs/common';
import { ConnectionService } from './connection.service';
import { Options } from 'amqplib';

@Injectable()
export class PublisherService {
  private readonly logger = new Logger(PublisherService.name);

  constructor(private readonly connectionService: ConnectionService) {}

  /**
   * Publishes a message to RabbitMQ using Publisher Confirms.
   * Resolves when RabbitMQ broker sends ACK confirmation.
   * Throws if broker NACKs or connection fails.
   */
  async publish<T>(
    exchange: string,
    routingKey: string,
    message: T,
    options?: Options.Publish,
  ): Promise<boolean> {
    const channelWrapper = this.connectionService.getChannelWrapper();

    try {
      const publishOptions: Options.Publish = {
        persistent: true,
        contentType: 'application/json',
        ...options,
      };

      await channelWrapper.publish(exchange, routingKey, message, publishOptions);
      this.logger.debug(
        `Publisher confirm ACK received for exchange='${exchange}', routingKey='${routingKey}'`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `Publisher confirm failed for exchange='${exchange}', routingKey='${routingKey}': ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }
}

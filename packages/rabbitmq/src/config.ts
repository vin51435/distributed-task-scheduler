export interface RabbitMQModuleOptions {
  urls: string[];
  exchangeName?: string;
  queueName?: string;
  routingKey?: string;
  heartbeatIntervalInSeconds?: number;
  reconnectTimeInSeconds?: number;
}

export const RABBITMQ_MODULE_OPTIONS = 'RABBITMQ_MODULE_OPTIONS';

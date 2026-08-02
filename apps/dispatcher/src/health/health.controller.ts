import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { ConnectionService } from '@scheduler/rabbitmq';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rabbitmqConnection: ConnectionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check for Dispatcher Service' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async check() {
    const isDbConnected = this.dataSource.isInitialized;
    const isRabbitConnected = this.rabbitmqConnection.getIsConnected();

    const isHealthy = isDbConnected && isRabbitConnected;

    return {
      status: isHealthy ? 'ok' : 'degraded',
      details: {
        database: isDbConnected ? 'connected' : 'disconnected',
        rabbitmq: isRabbitConnected ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { ConnectionService } from '@scheduler/rabbitmq';
import type { Response } from 'express';

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
    return this.ready();
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes Liveness probe (process is alive)' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  live() {
    return {
      status: 'ok',
      service: 'dispatcher-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes Readiness probe (DB & RabbitMQ connected)' })
  @ApiResponse({ status: 200, description: 'Dispatcher dependencies ready' })
  @ApiResponse({ status: 503, description: 'Dispatcher dependencies unavailable' })
  async ready(@Res({ passthrough: true }) res?: Response) {
    const isDbConnected = this.dataSource.isInitialized;
    const isRabbitConnected = this.rabbitmqConnection.getIsConnected();
    const isHealthy = isDbConnected && isRabbitConnected;

    if (!isHealthy && res) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: isHealthy ? 'ok' : 'error',
      service: 'dispatcher-service',
      checks: {
        database: isDbConnected ? 'connected' : 'disconnected',
        rabbitmq: isRabbitConnected ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

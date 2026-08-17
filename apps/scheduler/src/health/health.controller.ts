import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Health check for the scheduler service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check() {
    const isDbConnected = this.dataSource.isInitialized;

    return {
      status: isDbConnected ? 'ok' : 'degraded',
      details: {
        database: isDbConnected ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

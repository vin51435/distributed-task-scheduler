import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import type { Response } from 'express';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Standard Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check() {
    return this.ready();
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes Liveness probe (process is alive)' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  live() {
    return {
      status: 'ok',
      service: 'scheduler-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes Readiness probe (dependencies connected)' })
  @ApiResponse({ status: 200, description: 'Service is ready to serve traffic' })
  @ApiResponse({ status: 503, description: 'Service dependencies not ready' })
  async ready(@Res({ passthrough: true }) res?: Response) {
    let dbStatus = 'disconnected';
    let isReady = false;

    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.query('SELECT 1');
        dbStatus = 'connected';
        isReady = true;
      }
    } catch {
      dbStatus = 'unhealthy';
      isReady = false;
    }

    if (!isReady && res) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: isReady ? 'ok' : 'error',
      service: 'scheduler-service',
      checks: {
        database: dbStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

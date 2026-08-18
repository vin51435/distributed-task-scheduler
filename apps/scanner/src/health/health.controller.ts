import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import type { Response } from 'express';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Health check for Scanner Service' })
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
      service: 'scanner-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes Readiness probe (DB connected)' })
  @ApiResponse({ status: 200, description: 'Scanner dependencies ready' })
  @ApiResponse({ status: 503, description: 'Scanner dependencies unavailable' })
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
      service: 'scanner-service',
      checks: {
        database: dbStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

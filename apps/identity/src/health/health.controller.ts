import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '@scheduler-platform/auth';
import type { Response } from 'express';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Standard Health check endpoint' })
  check() {
    return this.ready();
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Kubernetes Liveness probe (process is alive)' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  live() {
    return {
      status: 'ok',
      service: 'identity-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes Readiness probe (DB connected)' })
  @ApiResponse({ status: 200, description: 'Identity service dependencies ready' })
  @ApiResponse({ status: 503, description: 'Identity service dependencies unavailable' })
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
      service: 'identity-service',
      checks: {
        database: dbStatus,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

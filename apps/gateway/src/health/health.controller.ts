import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import axios from 'axios';
import type { Response } from 'express';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly identityUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
  private readonly schedulerUrl = process.env.SCHEDULER_SERVICE_URL || 'http://localhost:3002';
  private readonly dispatcherUrl = process.env.DISPATCHER_SERVICE_URL || 'http://localhost:3004';

  @Get()
  @ApiOperation({ summary: 'Standard Gateway Health check' })
  @ApiResponse({ status: 200, description: 'API Gateway is healthy' })
  check() {
    return this.live();
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes Liveness probe (process is alive)' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  live() {
    return {
      status: 'ok',
      service: 'api-gateway',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Kubernetes Readiness probe (downstream microservices reachability)' })
  @ApiResponse({ status: 200, description: 'All downstream services reachable' })
  @ApiResponse({ status: 503, description: 'One or more downstream services unreachable' })
  async ready(@Res({ passthrough: true }) res?: Response) {
    const services = [
      { name: 'identity', url: `${this.identityUrl}/health/live` },
      { name: 'scheduler', url: `${this.schedulerUrl}/health/live` },
      { name: 'dispatcher', url: `${this.dispatcherUrl}/health/live` },
    ];

    const results = await Promise.all(
      services.map(async (svc) => {
        try {
          const r = await axios.get(svc.url, { timeout: 1500 });
          return { service: svc.name, status: r.data?.status || 'ok' };
        } catch (err: any) {
          return { service: svc.name, status: 'unreachable', error: err.message };
        }
      }),
    );

    const allOk = results.every((r) => r.status === 'ok');
    if (!allOk && res) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: allOk ? 'ok' : 'degraded',
      service: 'api-gateway',
      uptime: process.uptime(),
      downstream: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('services')
  @ApiOperation({ summary: 'Multi-service Ecosystem Health check' })
  @ApiResponse({ status: 200, description: 'Live connectivity status of all microservices' })
  async checkServices() {
    return this.ready();
  }
}

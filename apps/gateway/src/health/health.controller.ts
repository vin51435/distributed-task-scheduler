import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import axios from 'axios';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly identityUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
  private readonly schedulerUrl = process.env.SCHEDULER_SERVICE_URL || 'http://localhost:3002';
  private readonly dispatcherUrl = process.env.DISPATCHER_SERVICE_URL || 'http://localhost:3004';

  @Get()
  @ApiOperation({ summary: 'Gateway Health check endpoint' })
  @ApiResponse({ status: 200, description: 'API Gateway is healthy' })
  check() {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('services')
  @ApiOperation({ summary: 'Multi-service Ecosystem Health check' })
  @ApiResponse({ status: 200, description: 'Live connectivity status of all microservices' })
  async checkServices() {
    const services = [
      { name: 'identity', url: `${this.identityUrl}/api/health` },
      { name: 'scheduler', url: `${this.schedulerUrl}/api/health` },
      { name: 'dispatcher', url: `${this.dispatcherUrl}/api/health` },
    ];

    const results = await Promise.all(
      services.map(async (svc) => {
        try {
          const res = await axios.get(svc.url, { timeout: 2000 });
          return { service: svc.name, status: res.data?.status || 'ok', details: res.data };
        } catch (err: any) {
          return { service: svc.name, status: 'unreachable', error: err.message };
        }
      }),
    );

    const allOk = results.every((r) => r.status === 'ok');

    return {
      status: allOk ? 'healthy' : 'degraded',
      gateway: {
        status: 'ok',
        uptime: process.uptime(),
      },
      services: results,
      timestamp: new Date().toISOString(),
    };
  }
}

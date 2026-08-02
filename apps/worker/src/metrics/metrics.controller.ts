import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExecutionService } from '../worker/execution.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly executionService: ExecutionService) {}

  @Get()
  @ApiOperation({ summary: 'Execution metrics for Worker Service' })
  @ApiResponse({ status: 200, description: 'Current worker operational metrics' })
  getMetrics() {
    return {
      status: 'ok',
      metrics: this.executionService.getMetrics(),
      timestamp: new Date().toISOString(),
    };
  }
}

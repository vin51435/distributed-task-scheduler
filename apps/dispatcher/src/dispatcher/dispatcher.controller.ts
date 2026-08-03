import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DispatcherService } from './dispatcher.service';

@ApiTags('dispatcher')
@Controller()
export class DispatcherController {
  constructor(private readonly dispatcherService: DispatcherService) {}

  @Post('dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger job dispatch batch' })
  @ApiResponse({ status: 200, description: 'Dispatch batch completed successfully' })
  async triggerDispatch() {
    const result = await this.dispatcherService.dispatchBatch();
    return {
      message: 'Dispatch batch completed',
      data: result,
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get Dispatcher operational metrics' })
  @ApiResponse({ status: 200, description: 'Operational metrics retrieved' })
  getMetrics() {
    return {
      data: this.dispatcherService.getMetrics(),
    };
  }
}

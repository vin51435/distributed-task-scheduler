import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ScannerService, ScanResult, ScannerMetrics } from './scanner.service';

@ApiTags('scanner')
@Controller()
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Scanner health status' })
  getHealth(): { status: string; uptime: number } {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger scanner cycle' })
  @ApiResponse({ status: 200, description: 'Scan result summary' })
  async triggerScan(): Promise<ScanResult> {
    return this.scannerService.scan();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get operational metrics' })
  @ApiResponse({ status: 200, description: 'Operational scanner metrics' })
  getMetrics(): ScannerMetrics {
    return this.scannerService.getMetrics();
  }
}

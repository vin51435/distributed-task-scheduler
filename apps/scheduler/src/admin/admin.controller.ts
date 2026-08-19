import { Controller, Get, Post, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentTenant } from '@scheduler-platform/auth';
import { AdminService } from './admin.service';
import { JobStatus } from '@scheduler-platform/database';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('jobs')
  @ApiOperation({ summary: 'List and filter jobs with strict tenant isolation' })
  @ApiQuery({ name: 'status', enum: JobStatus, required: false })
  @ApiQuery({ name: 'workerType', required: false })
  @ApiQuery({ name: 'createdAfter', required: false })
  @ApiQuery({ name: 'createdBefore', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getJobs(
    @CurrentTenant() authTenantId?: string,
    @Query('status') status?: JobStatus,
    @Query('workerType') workerType?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.searchJobs({
      status,
      tenantId: authTenantId,
      workerType,
      createdAfter,
      createdBefore,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('executions')
  @ApiOperation({ summary: 'List job execution logs' })
  @ApiQuery({ name: 'jobId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getExecutions(
    @CurrentTenant() authTenantId?: string,
    @Query('jobId') jobId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getExecutions(jobId, Number(page), Number(limit), authTenantId);
  }

  @Get('workers')
  @ApiOperation({ summary: 'Get worker cluster statistics' })
  async getWorkers() {
    return this.adminService.getWorkers();
  }

  @Get('scanners')
  @ApiOperation({ summary: 'Get scanner cluster and bucket allocation info' })
  async getScanners() {
    return this.adminService.getScanners();
  }

  @Get('queues')
  @ApiOperation({ summary: 'Get queue depth and rate metrics' })
  async getQueues() {
    return this.adminService.getQueues();
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually retry a failed or dead job' })
  async retryJob(@CurrentTenant() authTenantId: string | undefined, @Param('id') jobId: string) {
    return this.adminService.retryJob(jobId, authTenantId);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually cancel a job' })
  async cancelJob(@CurrentTenant() authTenantId: string | undefined, @Param('id') jobId: string) {
    return this.adminService.cancelJob(jobId, authTenantId);
  }

  @Post('executions/:id/replay')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Replay a past execution as a new ready job' })
  async replayExecution(
    @CurrentTenant() authTenantId: string | undefined,
    @Param('id') executionId: string,
  ) {
    return this.adminService.replayExecution(executionId, authTenantId);
  }

  @Post('schedules/:id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a schedule' })
  async pauseSchedule(
    @CurrentTenant() authTenantId: string | undefined,
    @Param('id') scheduleId: string,
  ) {
    return this.adminService.pauseSchedule(scheduleId, authTenantId);
  }

  @Get('jobs/:id/audit')
  @ApiOperation({ summary: 'Get complete state transition audit trail for a job' })
  async getJobAudit(@CurrentTenant() authTenantId: string | undefined, @Param('id') jobId: string) {
    return this.adminService.getJobAudit(jobId, authTenantId);
  }
}

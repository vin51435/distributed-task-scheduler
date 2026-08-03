import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JobStatus } from '@scheduler/database';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('jobs')
  @ApiOperation({ summary: 'List and filter jobs' })
  @ApiQuery({ name: 'status', enum: JobStatus, required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getJobs(
    @Query('status') status?: JobStatus,
    @Query('tenantId') tenantId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getJobs(status, tenantId, Number(page), Number(limit));
  }

  @Get('executions')
  @ApiOperation({ summary: 'List job execution logs' })
  @ApiQuery({ name: 'jobId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getExecutions(
    @Query('jobId') jobId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getExecutions(jobId, Number(page), Number(limit));
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

  @Post('retry')
  @ApiOperation({ summary: 'Manually retry a failed or dead job' })
  async retryJob(@Body('jobId') jobId: string) {
    return this.adminService.retryJob(jobId);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Manually cancel a pending job' })
  async cancelJob(@Body('jobId') jobId: string) {
    return this.adminService.cancelJob(jobId);
  }

  @Post('pause')
  @ApiOperation({ summary: 'Pause a schedule' })
  async pauseSchedule(@Body('scheduleId') scheduleId: string) {
    return this.adminService.pauseSchedule(scheduleId);
  }

  @Get('jobs/:id/audit')
  @ApiOperation({ summary: 'Get complete state transition audit trail for a job' })
  async getJobAudit(@Param('id') jobId: string) {
    return this.adminService.getJobAudit(jobId);
  }
}

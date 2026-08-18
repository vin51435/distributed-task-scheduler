import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JobEntity,
  JobStatus,
  ExecutionEntity,
  ScheduleEntity,
  ScheduleStatus,
  JobAuditEntity,
} from '@scheduler/database';

export interface JobSearchParams {
  status?: JobStatus;
  workerType?: string;
  tenantId?: string;
  createdAfter?: string;
  createdBefore?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(ExecutionEntity)
    private readonly executionRepo: Repository<ExecutionEntity>,
    @InjectRepository(ScheduleEntity)
    private readonly scheduleRepo: Repository<ScheduleEntity>,
    @InjectRepository(JobAuditEntity)
    private readonly auditRepo: Repository<JobAuditEntity>,
  ) {}

  async searchJobs(params: JobSearchParams) {
    const page = params.page ? Math.max(1, Number(params.page)) : 1;
    const limit = params.limit ? Math.min(100, Math.max(1, Number(params.limit))) : 20;

    const query = this.jobRepo.createQueryBuilder('job');

    if (params.status) {
      query.andWhere('job.status = :status', { status: params.status });
    }
    if (params.workerType) {
      query.andWhere('job.worker_type = :workerType', { workerType: params.workerType });
    }
    if (params.tenantId) {
      query.andWhere('job.tenant_id = :tenantId', { tenantId: params.tenantId });
    }
    if (params.createdAfter) {
      query.andWhere('job.created_at >= :createdAfter', {
        createdAfter: new Date(params.createdAfter),
      });
    }
    if (params.createdBefore) {
      query.andWhere('job.created_at <= :createdBefore', {
        createdBefore: new Date(params.createdBefore),
      });
    }

    const [jobs, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('job.priority', 'DESC')
      .addOrderBy('job.execute_at', 'ASC')
      .getManyAndCount();

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getJobs(status?: JobStatus, tenantId?: string, page = 1, limit = 20) {
    return this.searchJobs({ status, tenantId, page, limit });
  }

  async getExecutions(jobId?: string, page = 1, limit = 20, tenantId?: string) {
    const query = this.executionRepo.createQueryBuilder('exec');
    if (jobId) {
      query.andWhere('exec.job_id = :jobId', { jobId });
    }

    if (tenantId) {
      query.innerJoin(JobEntity, 'j', 'j.id = exec.job_id').andWhere('j.tenant_id = :tenantId', {
        tenantId,
      });
    }

    const [executions, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('exec.createdAt', 'DESC')
      .getManyAndCount();

    return { executions, total, page, limit };
  }

  async getWorkers() {
    const workers = await this.executionRepo
      .createQueryBuilder('exec')
      .select('exec.nodeId', 'nodeId')
      .addSelect('COUNT(exec.id)', 'totalExecutions')
      .addSelect('MAX(exec.finishedAt)', 'lastActive')
      .groupBy('exec.nodeId')
      .getRawMany();

    return { workers };
  }

  async getScanners() {
    return {
      scanners: [
        { nodeId: 'scanner-1', status: 'ACTIVE', ownedBuckets: [0, 1, 2, 3] },
        { nodeId: 'scanner-2', status: 'ACTIVE', ownedBuckets: [4, 5, 6, 7] },
      ],
    };
  }

  async getQueues() {
    return {
      queues: [
        { name: 'jobs.ready', depth: 0, consumers: 4, publishRate: 12.5, ackRate: 12.5 },
        { name: 'jobs.dlq', depth: 0, consumers: 1, publishRate: 0, ackRate: 0 },
      ],
    };
  }

  async retryJob(jobId: string, tenantId?: string) {
    const where: any = { id: jobId };
    if (tenantId) where.tenantId = tenantId;

    const job = await this.jobRepo.findOne({ where });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const prevStatus = job.status;
    job.status = JobStatus.READY;
    job.nextRetryAt = new Date();
    job.attempt = 0;
    job.lastError = null;
    job.failureReason = null;
    await this.jobRepo.save(job);

    // Record Audit
    const audit = this.auditRepo.create({
      jobId: job.id,
      scheduleId: job.scheduleId,
      previousStatus: prevStatus,
      newStatus: JobStatus.READY,
      actorService: 'admin-service',
      reason: 'Manual retry request',
    });
    await this.auditRepo.save(audit);

    return { message: `Job ${jobId} reset to READY`, job };
  }

  async cancelJob(jobId: string, tenantId?: string) {
    const where: any = { id: jobId };
    if (tenantId) where.tenantId = tenantId;

    const job = await this.jobRepo.findOne({ where });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const prevStatus = job.status;
    job.status = JobStatus.CANCELLED;
    job.failureReason = 'Cancelled by user or administrator';
    await this.jobRepo.save(job);

    const audit = this.auditRepo.create({
      jobId: job.id,
      scheduleId: job.scheduleId,
      previousStatus: prevStatus,
      newStatus: JobStatus.CANCELLED,
      actorService: 'admin-service',
      reason: 'Manual cancellation',
    });
    await this.auditRepo.save(audit);

    return { message: `Job ${jobId} cancelled`, job };
  }

  async replayExecution(executionId: string, tenantId?: string) {
    const execution = await this.executionRepo.findOne({ where: { id: executionId } });
    if (!execution) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    const jobWhere: any = { id: execution.jobId };
    if (tenantId) jobWhere.tenantId = tenantId;

    const originalJob = await this.jobRepo.findOne({ where: jobWhere });
    if (!originalJob) {
      throw new NotFoundException(`Original Job ${execution.jobId} not found`);
    }

    // Clone job into a fresh new READY job
    const newJob = this.jobRepo.create({
      scheduleId: originalJob.scheduleId,
      status: JobStatus.READY,
      executeAt: new Date(),
      payload: originalJob.payload,
      attempt: 0,
      maxAttempts: originalJob.maxAttempts,
      retryPolicy: originalJob.retryPolicy,
      workerType: originalJob.workerType,
      routingKey: originalJob.routingKey,
      priority: (originalJob.priority || 50) + 10, // Slight priority boost for replayed tasks
      tenantId: originalJob.tenantId,
    });

    const savedJob = await this.jobRepo.save(newJob);

    const audit = this.auditRepo.create({
      jobId: savedJob.id,
      scheduleId: savedJob.scheduleId,
      previousStatus: JobStatus.READY,
      newStatus: JobStatus.READY,
      actorService: 'admin-service',
      reason: `Replayed from execution ${executionId}`,
    });
    await this.auditRepo.save(audit);

    return {
      message: `Execution ${executionId} successfully replayed as new Job ${savedJob.id}`,
      replayedJob: savedJob,
    };
  }

  async pauseSchedule(scheduleId: string, tenantId?: string) {
    const where: any = { id: scheduleId };
    if (tenantId) where.tenantId = tenantId;

    const schedule = await this.scheduleRepo.findOne({ where });
    if (!schedule) {
      throw new NotFoundException(`Schedule ${scheduleId} not found`);
    }

    schedule.status = ScheduleStatus.PAUSED;
    await this.scheduleRepo.save(schedule);

    return { message: `Schedule ${scheduleId} paused`, schedule };
  }

  async getJobAudit(jobId: string, tenantId?: string) {
    const jobWhere: any = { id: jobId };
    if (tenantId) jobWhere.tenantId = tenantId;

    const job = await this.jobRepo.findOne({ where: jobWhere });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const dbAudits = await this.auditRepo.find({
      where: { jobId },
      order: { createdAt: 'ASC' },
    });

    const executions = await this.executionRepo.find({
      where: { jobId },
      order: { createdAt: 'ASC' },
    });

    return {
      jobId,
      auditTrail: dbAudits,
      executions,
    };
  }
}

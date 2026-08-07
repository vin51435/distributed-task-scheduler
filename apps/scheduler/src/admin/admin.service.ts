import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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

  async getJobs(status?: JobStatus, tenantId?: string, page = 1, limit = 20) {
    const query = this.jobRepo.createQueryBuilder('job');
    if (status) {
      query.andWhere('job.status = :status', { status });
    }
    if (tenantId) {
      query.andWhere('job.tenant_id = :tenantId', { tenantId });
    }

    const [jobs, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('job.createdAt', 'DESC')
      .getManyAndCount();

    return { jobs, total, page, limit };
  }

  async getExecutions(jobId?: string, page = 1, limit = 20) {
    const query = this.executionRepo.createQueryBuilder('exec');
    if (jobId) {
      query.andWhere('exec.job_id = :jobId', { jobId });
    }

    const [executions, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('exec.createdAt', 'DESC')
      .getManyAndCount();

    return { executions, total, page, limit };
  }

  async getWorkers() {
    // Aggregated worker information from recent executions
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

  async retryJob(jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const prevStatus = job.status;
    job.status = JobStatus.READY;
    job.nextRetryAt = new Date();
    job.attempt = 0;
    await this.jobRepo.save(job);

    // Record Audit
    const audit = this.auditRepo.create({
      jobId: job.id,
      scheduleId: job.scheduleId,
      previousStatus: prevStatus,
      newStatus: JobStatus.READY,
      actorService: 'admin-service',
      reason: 'Manual admin retry request',
    });
    await this.auditRepo.save(audit);

    return { message: `Job ${jobId} reset to READY`, job };
  }

  async cancelJob(jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const prevStatus = job.status;
    job.status = JobStatus.DEAD;
    job.failureReason = 'Cancelled by Admin';
    await this.jobRepo.save(job);

    const audit = this.auditRepo.create({
      jobId: job.id,
      scheduleId: job.scheduleId,
      previousStatus: prevStatus,
      newStatus: JobStatus.DEAD,
      actorService: 'admin-service',
      reason: 'Manual admin cancellation',
    });
    await this.auditRepo.save(audit);

    return { message: `Job ${jobId} cancelled`, job };
  }

  async pauseSchedule(scheduleId: string) {
    const schedule = await this.scheduleRepo.findOne({ where: { id: scheduleId } });
    if (!schedule) {
      throw new NotFoundException(`Schedule ${scheduleId} not found`);
    }

    schedule.status = ScheduleStatus.PAUSED;
    await this.scheduleRepo.save(schedule);

    return { message: `Schedule ${scheduleId} paused`, schedule };
  }

  async getJobAudit(jobId: string) {
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

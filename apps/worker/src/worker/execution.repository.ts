import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExecutionEntity,
  ExecutionStatus,
  JobEntity,
  JobStatus,
} from '@scheduler-platform/database';

@Injectable()
export class ExecutionRepository {
  constructor(
    @InjectRepository(ExecutionEntity)
    private readonly executionRepo: Repository<ExecutionEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
  ) {}

  async countExecutionsForJob(jobId: string): Promise<number> {
    return this.executionRepo.count({ where: { jobId } });
  }

  async createExecution(
    jobId: string,
    attemptNumber: number,
    nodeId?: string,
  ): Promise<ExecutionEntity> {
    const execution = this.executionRepo.create({
      jobId,
      attemptNumber,
      retryNumber: attemptNumber,
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(),
      nodeId: nodeId || process.env.HOSTNAME || 'worker-1',
    });
    return this.executionRepo.save(execution);
  }

  async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus,
    finishedAt: Date = new Date(),
    errorMessage?: string,
    stackTrace?: string,
  ): Promise<void> {
    const execution = await this.executionRepo.findOne({ where: { id: executionId } });
    const startedAt = execution?.startedAt || finishedAt;
    const duration = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const exitCode = status === ExecutionStatus.SUCCEEDED ? 0 : 1;

    await this.executionRepo.update(executionId, {
      status,
      finishedAt,
      duration,
      exitCode,
      ...(errorMessage ? { errorMessage } : {}),
      ...(stackTrace ? { stackTrace } : {}),
    });
  }

  async findJobById(jobId: string): Promise<JobEntity | null> {
    return this.jobRepo.findOne({ where: { id: jobId } });
  }

  async updateJobStatus(jobId: string, status: JobStatus, attempt?: number): Promise<void> {
    const updatePayload: Partial<JobEntity> = { status, lastHeartbeat: new Date() };
    if (attempt !== undefined) {
      updatePayload.attempt = attempt;
    }
    await this.jobRepo.update(jobId, updatePayload);
  }

  async updateJobHeartbeat(jobId: string): Promise<void> {
    await this.jobRepo.update(jobId, { lastHeartbeat: new Date() });
  }

  async updateJobForRetry(
    jobId: string,
    nextRetryAt: Date,
    attempt: number,
    lastError: string,
    failureReason = 'RETRYABLE_ERROR',
  ): Promise<void> {
    await this.jobRepo.update(jobId, {
      status: JobStatus.READY,
      nextRetryAt,
      attempt,
      lastError,
      failureReason,
      lastHeartbeat: null,
    });
  }

  async updateJobDead(
    jobId: string,
    attempt: number,
    lastError: string,
    failureReason = 'EXHAUSTED_RETRIES',
  ): Promise<void> {
    await this.jobRepo.update(jobId, {
      status: JobStatus.DEAD,
      attempt,
      lastError,
      failureReason,
      lastHeartbeat: null,
    });
  }
}

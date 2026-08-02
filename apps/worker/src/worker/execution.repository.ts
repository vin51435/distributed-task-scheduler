import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExecutionEntity, ExecutionStatus, JobEntity, JobStatus } from '@scheduler/database';

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
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(),
      nodeId: nodeId || process.env.HOSTNAME || 'worker-1',
    });
    return this.executionRepo.save(execution);
  }

  async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus,
    finishedAt?: Date,
    errorMessage?: string,
  ): Promise<void> {
    await this.executionRepo.update(executionId, {
      status,
      finishedAt: finishedAt || new Date(),
      ...(errorMessage ? { errorMessage } : {}),
    });
  }

  async findJobById(jobId: string): Promise<JobEntity | null> {
    return this.jobRepo.findOne({ where: { id: jobId } });
  }

  async updateJobStatus(jobId: string, status: JobStatus, attempt?: number): Promise<void> {
    const updatePayload: Partial<JobEntity> = { status };
    if (attempt !== undefined) {
      updatePayload.attempt = attempt;
    }
    await this.jobRepo.update(jobId, updatePayload);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ExecutionEntity, ExecutionStatus, JobStatus } from '@scheduler/database';
import { ExecutionRepository } from './execution.repository';

export interface WorkerExecutionMetrics {
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  activeExecutions: number;
}

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private totalProcessed = 0;
  private totalSucceeded = 0;
  private totalFailed = 0;
  private activeExecutions = 0;

  constructor(private readonly repository: ExecutionRepository) {}

  /**
   * Immediately inserts an execution record with RUNNING status
   * and updates Job status to RUNNING.
   */
  async startExecution(jobId: string): Promise<ExecutionEntity> {
    const existingCount = await this.repository.countExecutionsForJob(jobId);
    const attemptNumber = existingCount + 1;

    const execution = await this.repository.createExecution(jobId, attemptNumber);
    await this.repository.updateJobStatus(jobId, JobStatus.RUNNING, attemptNumber);

    this.activeExecutions++;
    this.logger.log(
      `Execution ${execution.id} started for job ${jobId} (attempt #${attemptNumber})`,
    );

    return execution;
  }

  /**
   * Marks execution and job as SUCCEEDED upon successful handler completion.
   */
  async completeExecution(executionId: string, jobId: string): Promise<void> {
    await this.repository.updateExecutionStatus(executionId, ExecutionStatus.SUCCEEDED);
    await this.repository.updateJobStatus(jobId, JobStatus.SUCCEEDED);

    this.totalProcessed++;
    this.totalSucceeded++;
    if (this.activeExecutions > 0) this.activeExecutions--;

    this.logger.log(`Execution ${executionId} and Job ${jobId} updated to SUCCEEDED`);
  }

  /**
   * Marks execution and job as FAILED when handler execution fails.
   */
  async failExecution(executionId: string, jobId: string, errorMessage: string): Promise<void> {
    await this.repository.updateExecutionStatus(
      executionId,
      ExecutionStatus.FAILED,
      new Date(),
      errorMessage,
    );
    await this.repository.updateJobStatus(jobId, JobStatus.FAILED);

    this.totalProcessed++;
    this.totalFailed++;
    if (this.activeExecutions > 0) this.activeExecutions--;

    this.logger.error(`Execution ${executionId} and Job ${jobId} failed: ${errorMessage}`);
  }

  /**
   * Returns worker metrics snapshot.
   */
  getMetrics(): WorkerExecutionMetrics {
    return {
      totalProcessed: this.totalProcessed,
      totalSucceeded: this.totalSucceeded,
      totalFailed: this.totalFailed,
      activeExecutions: this.activeExecutions,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobExecutionPayload, ExecutionResult } from '../interface';

@Injectable()
export class NoopHandler implements JobHandler {
  readonly type = 'NOOP';
  private readonly logger = new Logger(NoopHandler.name);

  canHandle(workerType: string): boolean {
    if (!workerType) return false;
    const normalized = workerType.toUpperCase().replace(/^WORKER\./, '');
    return normalized === 'NOOP';
  }

  async execute(
    payloadOrJob: JobExecutionPayload | Record<string, any>,
    jobId?: string,
  ): Promise<ExecutionResult | void> {
    const startTime = Date.now();
    const id = jobId || (payloadOrJob && 'jobId' in payloadOrJob ? payloadOrJob.jobId : undefined);
    this.logger.log(`NoopHandler executed for jobId: ${id || 'unknown'}`);
    return {
      success: true,
      durationMs: Date.now() - startTime,
      output: { status: 'noop_completed' },
    };
  }
}

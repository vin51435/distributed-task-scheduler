import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobExecutionPayload, ExecutionResult } from '../interface';

@Injectable()
export class CustomHandler implements JobHandler {
  readonly type = 'CUSTOM';
  private readonly logger = new Logger(CustomHandler.name);

  canHandle(workerType: string): boolean {
    if (!workerType) return false;
    const normalized = workerType.toUpperCase().replace(/^WORKER\./, '');
    return normalized === 'CUSTOM' || normalized.startsWith('CUSTOM_');
  }

  async execute(
    payloadOrJob: JobExecutionPayload | Record<string, any>,
    jobId?: string,
  ): Promise<ExecutionResult | void> {
    const startTime = Date.now();
    const payload =
      payloadOrJob && 'payload' in payloadOrJob && typeof payloadOrJob.payload === 'object'
        ? payloadOrJob.payload
        : payloadOrJob;
    const id = jobId || ('jobId' in payloadOrJob ? payloadOrJob.jobId : undefined);

    this.logger.log(`CustomHandler executing generic custom script for job: ${id || 'unknown'}`);

    if (payload?.fail === true) {
      throw new Error(payload.error || 'Custom job script execution failed');
    }

    return {
      success: true,
      durationMs: Date.now() - startTime,
      output: {
        executed: true,
        customCode: payload?.scriptId || 'default-script',
        exitCode: 0,
      },
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobExecutionPayload, ExecutionResult } from '../interface';

@Injectable()
export class AiHandler implements JobHandler {
  readonly type = 'AI';
  private readonly logger = new Logger(AiHandler.name);

  canHandle(workerType: string): boolean {
    if (!workerType) return false;
    const normalized = workerType.toUpperCase().replace(/^WORKER\./, '');
    return normalized === 'AI' || normalized === 'LLM_INFERENCE' || normalized === 'EMBEDDINGS';
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

    this.logger.log(`AiHandler executing inference task for job: ${id || 'unknown'}`);

    if (payload?.fail === true) {
      throw new Error(
        payload.error || 'AI inference error: rate limit exceeded on upstream provider',
      );
    }

    return {
      success: true,
      durationMs: Date.now() - startTime,
      output: {
        model: payload?.model || 'gemini-1.5-flash',
        tokensUsed: payload?.prompt ? payload.prompt.length / 4 + 50 : 120,
        result: 'Inference completed successfully',
      },
    };
  }
}

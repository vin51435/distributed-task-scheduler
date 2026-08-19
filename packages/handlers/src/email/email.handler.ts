import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobExecutionPayload, ExecutionResult } from '../interface';

@Injectable()
export class EmailHandler implements JobHandler {
  readonly type = 'EMAIL';
  private readonly logger = new Logger(EmailHandler.name);

  canHandle(workerType: string): boolean {
    if (!workerType) return false;
    const normalized = workerType.toUpperCase().replace(/^WORKER\./, '');
    return normalized === 'EMAIL' || normalized === 'SEND_EMAIL';
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
    const idempotencyKey = id ? `job-${id}` : 'idem-unknown';

    this.logger.log(
      `Starting EmailHandler execution (Entity-ID: ${idempotencyKey}) for payload: ${JSON.stringify(
        payload,
      )}`,
    );

    if (payload?.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, Number(payload.delayMs)));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (payload?.error === 'poison' || payload?.failType === 'poison') {
      throw new Error('Poison message: invalid payload structure');
    }

    if (payload?.error === 'non_retryable' || payload?.failType === 'non_retryable') {
      throw new Error('Bad email recipient address: 404 not found');
    }

    if (payload?.fail === true || payload?.error || payload?.shouldFail === true) {
      throw new Error(
        typeof payload.error === 'string' ? payload.error : 'Simulated network connection timeout',
      );
    }

    this.logger.log(`Executed EmailHandler successfully (Message-ID: ${idempotencyKey})`);

    return {
      success: true,
      durationMs: Date.now() - startTime,
      output: { deliveredTo: payload?.to || 'test@example.com', messageId: idempotencyKey },
    };
  }
}

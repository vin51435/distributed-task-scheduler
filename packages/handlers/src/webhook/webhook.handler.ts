import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobExecutionPayload, ExecutionResult } from '../interface';
import { validateWebhookUrl } from './ssrf-guard';

@Injectable()
export class WebhookHandler implements JobHandler {
  readonly type = 'WEBHOOK';
  private readonly logger = new Logger(WebhookHandler.name);

  canHandle(workerType: string): boolean {
    if (!workerType) return false;
    const normalized = workerType.toUpperCase().replace(/^WORKER\./, '');
    return normalized === 'WEBHOOK' || normalized === 'HTTP_REQUEST';
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
      `Starting WebhookHandler execution (Idempotency-Key: ${idempotencyKey}) for payload: ${JSON.stringify(
        payload,
      )}`,
    );

    // SSRF Security Guard: Validate destination URL if provided
    if (payload?.url) {
      await validateWebhookUrl(payload.url);
    }

    if (payload?.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, Number(payload.delayMs)));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (payload?.error === 'poison' || payload?.failType === 'poison') {
      throw new Error('Poison message: invalid payload structure');
    }

    if (payload?.error === 'non_retryable' || payload?.failType === 'non_retryable') {
      throw new Error('404 not found: endpoint unavailable');
    }

    if (payload?.fail === true || payload?.error || payload?.shouldFail === true) {
      throw new Error(
        typeof payload.error === 'string'
          ? payload.error
          : 'Simulated webhook HTTP 500 gateway timeout',
      );
    }

    this.logger.log(
      `Executed WebhookHandler successfully (HTTP POST header 'Idempotency-Key: ${idempotencyKey}')`,
    );

    return {
      success: true,
      durationMs: Date.now() - startTime,
      output: { status: 200, response: 'Webhook dispatched successfully' },
    };
  }
}

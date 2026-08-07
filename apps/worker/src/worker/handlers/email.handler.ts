import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from './job-handler.interface';

@Injectable()
export class EmailHandler implements JobHandler {
  readonly type = 'EMAIL';
  private readonly logger = new Logger(EmailHandler.name);

  async execute(payload: Record<string, any>, jobId?: string): Promise<void> {
    const idempotencyKey = jobId ? `job-${jobId}` : 'idem-unknown';
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
  }
}

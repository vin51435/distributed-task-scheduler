import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from './job-handler.interface';

@Injectable()
export class WebhookHandler implements JobHandler {
  readonly type = 'WEBHOOK';
  private readonly logger = new Logger(WebhookHandler.name);

  async execute(payload: Record<string, any>): Promise<void> {
    this.logger.log(`Starting WebhookHandler execution for payload: ${JSON.stringify(payload)}`);

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

    this.logger.log('Executed WebhookHandler successfully');
  }
}

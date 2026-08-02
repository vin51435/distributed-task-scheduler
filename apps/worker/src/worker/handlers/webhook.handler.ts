import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from './job-handler.interface';

@Injectable()
export class WebhookHandler implements JobHandler {
  readonly type = 'WEBHOOK';
  private readonly logger = new Logger(WebhookHandler.name);

  async execute(payload: Record<string, any>): Promise<void> {
    this.logger.log(`Starting WebhookHandler execution for payload: ${JSON.stringify(payload)}`);

    // Simulate work (e.g. performing HTTP POST webhook call)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logger.log('Executed WebhookHandler successfully');
  }
}

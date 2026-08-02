import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from './job-handler.interface';

@Injectable()
export class EmailHandler implements JobHandler {
  readonly type = 'EMAIL';
  private readonly logger = new Logger(EmailHandler.name);

  async execute(payload: Record<string, any>): Promise<void> {
    this.logger.log(`Starting EmailHandler execution for payload: ${JSON.stringify(payload)}`);

    // Simulate work (e.g. sending SMTP email)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logger.log('Executed EmailHandler successfully');
  }
}

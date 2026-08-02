import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from './job-handler.interface';

@Injectable()
export class NoopHandler implements JobHandler {
  readonly type = 'NOOP';
  private readonly logger = new Logger(NoopHandler.name);

  async execute(payload: Record<string, any>): Promise<void> {
    this.logger.log(`Executing NoopHandler for payload: ${JSON.stringify(payload)}`);
  }
}

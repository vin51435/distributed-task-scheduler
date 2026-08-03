import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from './handlers/job-handler.interface';
import { EmailHandler } from './handlers/email.handler';
import { WebhookHandler } from './handlers/webhook.handler';
import { NoopHandler } from './handlers/noop.handler';

@Injectable()
export class HandlerRegistry {
  private readonly logger = new Logger(HandlerRegistry.name);
  private readonly handlers = new Map<string, JobHandler>();

  constructor(
    private readonly emailHandler: EmailHandler,
    private readonly webhookHandler: WebhookHandler,
    private readonly noopHandler: NoopHandler,
  ) {
    this.register(this.emailHandler);
    this.register(this.webhookHandler);
    this.register(this.noopHandler);
  }

  /**
   * Registers a handler mapping using its declared `type`.
   */
  public register(handler: JobHandler): void {
    const key = handler.type.toUpperCase();
    this.handlers.set(key, handler);
    this.logger.log(`Registered job handler for type '${key}'`);
  }

  /**
   * Retrieves registered JobHandler for the given job type.
   * Normalize strings (e.g., 'worker.email' -> 'EMAIL' or 'EMAIL' -> 'EMAIL').
   */
  public getHandler(type: string): JobHandler {
    if (!type) {
      throw new Error('Worker type must be provided');
    }

    let normalizedKey = type.trim().toUpperCase();
    if (normalizedKey.startsWith('WORKER.')) {
      normalizedKey = normalizedKey.substring(7);
    }

    const handler = this.handlers.get(normalizedKey);
    if (!handler) {
      throw new Error(`No handler registered for worker type '${type}'`);
    }

    return handler;
  }
}

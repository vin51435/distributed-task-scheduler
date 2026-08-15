import { Injectable, Logger, Optional } from '@nestjs/common';
import { JobHandler } from '../interface';
import { EmailHandler } from '../email/email.handler';
import { WebhookHandler } from '../webhook/webhook.handler';
import { NoopHandler } from '../noop/noop.handler';
import { CompressionHandler } from '../compression/compression.handler';
import { ImageProcessingHandler } from '../image-processing/image-processing.handler';
import { AiHandler } from '../ai/ai.handler';
import { CustomHandler } from '../custom/custom.handler';

@Injectable()
export class HandlerRegistry {
  private readonly logger = new Logger(HandlerRegistry.name);
  private readonly handlers: JobHandler[] = [];
  private readonly fallbackHandler: JobHandler;

  constructor(
    @Optional() emailHandler?: EmailHandler,
    @Optional() webhookHandler?: WebhookHandler,
    @Optional() noopHandler?: NoopHandler,
    @Optional() compressionHandler?: CompressionHandler,
    @Optional() imageProcessingHandler?: ImageProcessingHandler,
    @Optional() aiHandler?: AiHandler,
    @Optional() customHandler?: CustomHandler,
  ) {
    this.fallbackHandler = noopHandler || new NoopHandler();

    const defaults = [
      emailHandler || new EmailHandler(),
      webhookHandler || new WebhookHandler(),
      this.fallbackHandler,
      compressionHandler || new CompressionHandler(),
      imageProcessingHandler || new ImageProcessingHandler(),
      aiHandler || new AiHandler(),
      customHandler || new CustomHandler(),
    ];

    defaults.forEach((h) => this.register(h));
  }

  /**
   * Registers a new JobHandler plugin.
   */
  public register(handler: JobHandler): void {
    if (!handler) return;
    // Avoid duplicate instances of same handler type
    const existingIndex = this.handlers.findIndex(
      (h) => h.type.toUpperCase() === handler.type.toUpperCase(),
    );
    if (existingIndex >= 0) {
      this.handlers[existingIndex] = handler;
    } else {
      this.handlers.push(handler);
    }
    this.logger.log(`Registered handler plugin for type '${handler.type.toUpperCase()}'`);
  }

  /**
   * Finds a handler that can handle the workerType.
   */
  public getHandler(workerType: string): JobHandler {
    if (!workerType || typeof workerType !== 'string' || workerType.trim() === '') {
      throw new Error('Worker type must be provided');
    }

    const trimmed = workerType.trim();

    // 1. Direct canHandle check
    const matched = this.handlers.find((h) => {
      try {
        return h.canHandle(trimmed);
      } catch {
        return false;
      }
    });

    if (matched) {
      return matched;
    }

    // 2. Direct type matching
    const normalizedKey = trimmed.toUpperCase().replace(/^WORKER\./, '');
    const byType = this.handlers.find((h) => h.type.toUpperCase() === normalizedKey);
    if (byType) {
      return byType;
    }

    this.logger.warn(
      `No handler registered for worker type '${workerType}', defaulting to NoopHandler`,
    );
    return this.fallbackHandler;
  }

  /**
   * Returns all registered handlers.
   */
  public getAllHandlers(): readonly JobHandler[] {
    return this.handlers;
  }
}

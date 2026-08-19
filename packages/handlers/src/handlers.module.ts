import { Module } from '@nestjs/common';
import { EmailHandler } from './email/email.handler';
import { WebhookHandler } from './webhook/webhook.handler';
import { NoopHandler } from './noop/noop.handler';
import { CompressionHandler } from './compression/compression.handler';
import { ImageProcessingHandler } from './image-processing/image-processing.handler';
import { AiHandler } from './ai/ai.handler';
import { CustomHandler } from './custom/custom.handler';
import { HandlerRegistry } from './registry/handler.registry';

@Module({
  providers: [
    EmailHandler,
    WebhookHandler,
    NoopHandler,
    CompressionHandler,
    ImageProcessingHandler,
    AiHandler,
    CustomHandler,
    HandlerRegistry,
  ],
  exports: [
    EmailHandler,
    WebhookHandler,
    NoopHandler,
    CompressionHandler,
    ImageProcessingHandler,
    AiHandler,
    CustomHandler,
    HandlerRegistry,
  ],
})
export class HandlersModule {}

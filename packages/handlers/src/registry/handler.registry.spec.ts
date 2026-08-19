import { HandlerRegistry } from './handler.registry';
import { EmailHandler } from '../email/email.handler';
import { WebhookHandler } from '../webhook/webhook.handler';
import { NoopHandler } from '../noop/noop.handler';
import { CompressionHandler } from '../compression/compression.handler';
import { ImageProcessingHandler } from '../image-processing/image-processing.handler';
import { AiHandler } from '../ai/ai.handler';
import { CustomHandler } from '../custom/custom.handler';

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry;
  let emailHandler: EmailHandler;
  let webhookHandler: WebhookHandler;
  let noopHandler: NoopHandler;
  let compressionHandler: CompressionHandler;
  let imageProcessingHandler: ImageProcessingHandler;
  let aiHandler: AiHandler;
  let customHandler: CustomHandler;

  beforeEach(() => {
    emailHandler = new EmailHandler();
    webhookHandler = new WebhookHandler();
    noopHandler = new NoopHandler();
    compressionHandler = new CompressionHandler();
    imageProcessingHandler = new ImageProcessingHandler();
    aiHandler = new AiHandler();
    customHandler = new CustomHandler();

    registry = new HandlerRegistry(
      emailHandler,
      webhookHandler,
      noopHandler,
      compressionHandler,
      imageProcessingHandler,
      aiHandler,
      customHandler,
    );
  });

  it('should resolve email handler for EMAIL and WORKER.EMAIL', () => {
    expect(registry.getHandler('EMAIL')).toBe(emailHandler);
    expect(registry.getHandler('worker.email')).toBe(emailHandler);
    expect(registry.getHandler('SEND_EMAIL')).toBe(emailHandler);
  });

  it('should resolve webhook handler for WEBHOOK and HTTP_REQUEST', () => {
    expect(registry.getHandler('WEBHOOK')).toBe(webhookHandler);
    expect(registry.getHandler('HTTP_REQUEST')).toBe(webhookHandler);
  });

  it('should resolve new plugin handlers (compression, image, ai, custom)', () => {
    expect(registry.getHandler('COMPRESSION')).toBe(compressionHandler);
    expect(registry.getHandler('IMAGE_PROCESSING')).toBe(imageProcessingHandler);
    expect(registry.getHandler('AI')).toBe(aiHandler);
    expect(registry.getHandler('CUSTOM')).toBe(customHandler);
  });

  it('should fallback to NoopHandler on unregistered worker types', () => {
    expect(registry.getHandler('UNREGISTERED_WORKER')).toBe(noopHandler);
  });

  it('should throw when empty worker type is passed', () => {
    expect(() => registry.getHandler('')).toThrow('Worker type must be provided');
  });

  it('should allow dynamic registration of custom plugin handlers', () => {
    const customPlugin = {
      type: 'DYNAMIC_PLUGIN',
      canHandle: (type: string) => type === 'DYNAMIC_PLUGIN',
      execute: jest.fn().mockResolvedValue({ success: true }),
    };

    registry.register(customPlugin);
    expect(registry.getHandler('DYNAMIC_PLUGIN')).toBe(customPlugin);
  });
});

import { HandlerRegistry } from './handler.registry';
import { EmailHandler } from './handlers/email.handler';
import { WebhookHandler } from './handlers/webhook.handler';
import { NoopHandler } from './handlers/noop.handler';

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry;
  let emailHandler: EmailHandler;
  let webhookHandler: WebhookHandler;
  let noopHandler: NoopHandler;

  beforeEach(() => {
    emailHandler = new EmailHandler();
    webhookHandler = new WebhookHandler();
    noopHandler = new NoopHandler();
    registry = new HandlerRegistry(emailHandler, webhookHandler, noopHandler);
  });

  it('should resolve EmailHandler for "EMAIL" or "worker.email"', () => {
    expect(registry.getHandler('EMAIL')).toBe(emailHandler);
    expect(registry.getHandler('worker.email')).toBe(emailHandler);
    expect(registry.getHandler('email')).toBe(emailHandler);
  });

  it('should resolve WebhookHandler for "WEBHOOK"', () => {
    expect(registry.getHandler('WEBHOOK')).toBe(webhookHandler);
  });

  it('should resolve NoopHandler for "NOOP"', () => {
    expect(registry.getHandler('NOOP')).toBe(noopHandler);
  });

  it('should throw error for unknown worker type', () => {
    expect(() => registry.getHandler('UNKNOWN')).toThrow(
      "No handler registered for worker type 'UNKNOWN'",
    );
  });

  it('should throw error if type is empty', () => {
    expect(() => registry.getHandler('')).toThrow('Worker type must be provided');
  });
});

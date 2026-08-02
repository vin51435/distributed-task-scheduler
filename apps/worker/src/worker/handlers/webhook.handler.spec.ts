import { WebhookHandler } from './webhook.handler';

describe('WebhookHandler', () => {
  let handler: WebhookHandler;

  beforeEach(() => {
    handler = new WebhookHandler();
  });

  it('should have type WEBHOOK', () => {
    expect(handler.type).toBe('WEBHOOK');
  });

  it('should execute successfully', async () => {
    const spyLog = jest.spyOn((handler as any).logger, 'log');
    await handler.execute({ url: 'https://webhook.site/test' });
    expect(spyLog).toHaveBeenCalledWith(
      expect.stringContaining('Executed WebhookHandler successfully'),
    );
  });
});

import { EmailHandler } from './email.handler';

describe('EmailHandler', () => {
  let handler: EmailHandler;

  beforeEach(() => {
    handler = new EmailHandler();
  });

  it('should have type EMAIL', () => {
    expect(handler.type).toBe('EMAIL');
  });

  it('should execute successfully', async () => {
    const spyLog = jest.spyOn((handler as any).logger, 'log');
    await handler.execute({ to: 'test@example.com', body: 'Hello' });
    expect(spyLog).toHaveBeenCalledWith(
      expect.stringContaining('Executed EmailHandler successfully'),
    );
  });
});

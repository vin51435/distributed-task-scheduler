import { NoopHandler } from './noop.handler';

describe('NoopHandler', () => {
  let handler: NoopHandler;

  beforeEach(() => {
    handler = new NoopHandler();
  });

  it('should have type NOOP', () => {
    expect(handler.type).toBe('NOOP');
  });

  it('should execute successfully', async () => {
    const spyLog = jest.spyOn((handler as any).logger, 'log');
    await handler.execute({ foo: 'bar' });
    expect(spyLog).toHaveBeenCalledWith(expect.stringContaining('NoopHandler executed'));
  });
});

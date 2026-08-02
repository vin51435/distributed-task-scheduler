import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionService } from '@scheduler/rabbitmq';
import { ConsumerService } from './consumer.service';
import { HandlerRegistry } from './handler.registry';
import { ExecutionService } from './execution.service';

describe('ConsumerService', () => {
  let service: ConsumerService;
  let connectionService: jest.Mocked<ConnectionService>;
  let handlerRegistry: jest.Mocked<HandlerRegistry>;
  let executionService: jest.Mocked<ExecutionService>;

  beforeEach(async () => {
    const mockChannelWrapper = {
      addSetup: jest.fn(),
    };

    const mockConn = {
      getChannelWrapper: jest.fn().mockReturnValue(mockChannelWrapper),
    };

    const mockRegistry = {
      getHandler: jest.fn(),
    };

    const mockExecService = {
      startExecution: jest.fn(),
      completeExecution: jest.fn(),
      failExecution: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerService,
        { provide: ConnectionService, useValue: mockConn },
        { provide: HandlerRegistry, useValue: mockRegistry },
        { provide: ExecutionService, useValue: mockExecService },
      ],
    }).compile();

    service = module.get<ConsumerService>(ConsumerService);
    connectionService = module.get(ConnectionService);
    handlerRegistry = module.get(HandlerRegistry);
    executionService = module.get(ExecutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processMessage', () => {
    it('should parse valid message, start execution, invoke handler, complete execution and ack', async () => {
      const mockChannel: any = { ack: jest.fn(), nack: jest.fn() };
      const envelope = {
        jobId: 'job-100',
        workerType: 'EMAIL',
        payload: { recipient: 'user@test.com' },
      };
      const msg: any = { content: Buffer.from(JSON.stringify(envelope)) };

      const mockExecution = { id: 'exec-1' };
      executionService.startExecution.mockResolvedValueOnce(mockExecution as any);

      const mockHandler = { execute: jest.fn().mockResolvedValueOnce(undefined), type: 'EMAIL' };
      handlerRegistry.getHandler.mockReturnValueOnce(mockHandler as any);

      await service.processMessage(mockChannel, msg);

      expect(executionService.startExecution).toHaveBeenCalledWith('job-100');
      expect(handlerRegistry.getHandler).toHaveBeenCalledWith('EMAIL');
      expect(mockHandler.execute).toHaveBeenCalledWith(envelope.payload);
      expect(executionService.completeExecution).toHaveBeenCalledWith('exec-1', 'job-100');
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should fail execution and ack if handler throws error', async () => {
      const mockChannel: any = { ack: jest.fn(), nack: jest.fn() };
      const envelope = { jobId: 'job-101', workerType: 'EMAIL', payload: {} };
      const msg: any = { content: Buffer.from(JSON.stringify(envelope)) };

      const mockExecution = { id: 'exec-2' };
      executionService.startExecution.mockResolvedValueOnce(mockExecution as any);

      const mockHandler = {
        execute: jest.fn().mockRejectedValueOnce(new Error('Handler failed')),
        type: 'EMAIL',
      };
      handlerRegistry.getHandler.mockReturnValueOnce(mockHandler as any);

      await service.processMessage(mockChannel, msg);

      expect(executionService.failExecution).toHaveBeenCalledWith(
        'exec-2',
        'job-101',
        'Handler failed',
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should ack and skip if message content is invalid JSON', async () => {
      const mockChannel: any = { ack: jest.fn(), nack: jest.fn() };
      const msg: any = { content: Buffer.from('invalid-json') };

      await service.processMessage(mockChannel, msg);

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
      expect(executionService.startExecution).not.toHaveBeenCalled();
    });
  });
});

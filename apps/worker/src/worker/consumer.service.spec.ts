import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionService, PublisherService } from '@scheduler/rabbitmq';
import { JobStatus, RetryPolicy } from '@scheduler/database';
import { ConsumerService } from './consumer.service';
import { HandlerRegistry } from './handler.registry';
import { ExecutionService } from './execution.service';

describe('ConsumerService', () => {
  let service: ConsumerService;
  let connectionService: jest.Mocked<ConnectionService>;
  let publisherService: jest.Mocked<PublisherService>;
  let handlerRegistry: jest.Mocked<HandlerRegistry>;
  let executionService: jest.Mocked<ExecutionService>;

  beforeEach(async () => {
    const mockChannelWrapper = {
      addSetup: jest.fn(),
    };

    const mockConn = {
      getChannelWrapper: jest.fn().mockReturnValue(mockChannelWrapper),
    };

    const mockPublisher = {
      publish: jest.fn().mockResolvedValue(true),
    };

    const mockRegistry = {
      getHandler: jest.fn(),
    };

    const mockExecService = {
      startExecution: jest.fn(),
      completeExecution: jest.fn(),
      failExecution: jest.fn(),
      failExecutionWithRetry: jest.fn(),
      failExecutionDead: jest.fn(),
      findJobById: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({ activeExecutions: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerService,
        { provide: ConnectionService, useValue: mockConn },
        { provide: PublisherService, useValue: mockPublisher },
        { provide: HandlerRegistry, useValue: mockRegistry },
        { provide: ExecutionService, useValue: mockExecService },
      ],
    }).compile();

    service = module.get<ConsumerService>(ConsumerService);
    connectionService = module.get(ConnectionService);
    publisherService = module.get(PublisherService);
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

      executionService.findJobById.mockResolvedValueOnce({
        id: 'job-100',
        status: JobStatus.READY,
        attempt: 0,
        maxAttempts: 5,
        retryPolicy: RetryPolicy.EXPONENTIAL_BACKOFF,
      } as any);

      const mockExecution = { id: 'exec-1' };
      executionService.startExecution.mockResolvedValueOnce(mockExecution as any);

      const mockHandler = { execute: jest.fn().mockResolvedValueOnce(undefined), type: 'EMAIL' };
      handlerRegistry.getHandler.mockReturnValueOnce(mockHandler as any);

      await service.processMessage(mockChannel, msg, 'worker.email.dlq', 'scheduler.exchange');

      expect(executionService.startExecution).toHaveBeenCalledWith('job-100');
      expect(handlerRegistry.getHandler).toHaveBeenCalledWith('EMAIL');
      expect(mockHandler.execute).toHaveBeenCalledWith(envelope.payload);
      expect(executionService.completeExecution).toHaveBeenCalledWith('exec-1', 'job-100');
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should schedule retry when handler throws retryable error and attempts remain', async () => {
      const mockChannel: any = { ack: jest.fn(), nack: jest.fn() };
      const envelope = { jobId: 'job-101', workerType: 'EMAIL', payload: {} };
      const msg: any = { content: Buffer.from(JSON.stringify(envelope)) };

      executionService.findJobById.mockResolvedValueOnce({
        id: 'job-101',
        status: JobStatus.READY,
        attempt: 1,
        maxAttempts: 5,
        retryPolicy: RetryPolicy.EXPONENTIAL_BACKOFF,
      } as any);

      const mockExecution = { id: 'exec-2' };
      executionService.startExecution.mockResolvedValueOnce(mockExecution as any);

      const mockHandler = {
        execute: jest.fn().mockRejectedValueOnce(new Error('Network timeout')),
        type: 'EMAIL',
      };
      handlerRegistry.getHandler.mockReturnValueOnce(mockHandler as any);

      await service.processMessage(mockChannel, msg, 'worker.email.dlq', 'scheduler.exchange');

      expect(executionService.failExecutionWithRetry).toHaveBeenCalledWith(
        'exec-2',
        'job-101',
        2,
        expect.any(Date),
        'Network timeout',
        expect.any(String),
        'RETRYABLE_ERROR',
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should move job to DEAD and publish to DLQ when max attempts reached', async () => {
      const mockChannel: any = { ack: jest.fn(), nack: jest.fn() };
      const envelope = { jobId: 'job-102', workerType: 'EMAIL', payload: {} };
      const msg: any = { content: Buffer.from(JSON.stringify(envelope)) };

      executionService.findJobById.mockResolvedValueOnce({
        id: 'job-102',
        status: JobStatus.READY,
        attempt: 4,
        maxAttempts: 5,
        retryPolicy: RetryPolicy.EXPONENTIAL_BACKOFF,
      } as any);

      const mockExecution = { id: 'exec-3' };
      executionService.startExecution.mockResolvedValueOnce(mockExecution as any);

      const mockHandler = {
        execute: jest.fn().mockRejectedValueOnce(new Error('Permanent failure')),
        type: 'EMAIL',
      };
      handlerRegistry.getHandler.mockReturnValueOnce(mockHandler as any);

      await service.processMessage(mockChannel, msg, 'worker.email.dlq', 'scheduler.exchange');

      expect(executionService.failExecutionDead).toHaveBeenCalledWith(
        'exec-3',
        'job-102',
        5,
        'Permanent failure',
        expect.any(String),
        'EXHAUSTED_RETRIES',
      );
      expect(publisherService.publish).toHaveBeenCalledWith(
        'scheduler.exchange',
        'worker.email.dlq',
        expect.objectContaining({ jobId: 'job-102', reason: 'EXHAUSTED_RETRIES', attempt: 5 }),
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should publish poison message to DLQ and ack without executing handler', async () => {
      const mockChannel: any = { ack: jest.fn(), nack: jest.fn() };
      const msg: any = { content: Buffer.from('invalid-json') };

      await service.processMessage(mockChannel, msg, 'worker.email.dlq', 'scheduler.exchange');

      expect(publisherService.publish).toHaveBeenCalledWith(
        'scheduler.exchange',
        'worker.email.dlq',
        expect.objectContaining({ reason: 'POISON_MESSAGE_MALFORMED_JSON' }),
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
      expect(executionService.startExecution).not.toHaveBeenCalled();
    });

    it('should skip execution for duplicate message if job is already RUNNING or SUCCEEDED', async () => {
      const mockChannel: any = { ack: jest.fn(), nack: jest.fn() };
      const envelope = { jobId: 'job-103', workerType: 'EMAIL' };
      const msg: any = { content: Buffer.from(JSON.stringify(envelope)) };

      executionService.findJobById.mockResolvedValueOnce({
        id: 'job-103',
        status: JobStatus.RUNNING,
      } as any);

      await service.processMessage(mockChannel, msg, 'worker.email.dlq', 'scheduler.exchange');

      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
      expect(executionService.startExecution).not.toHaveBeenCalled();
    });
  });
});

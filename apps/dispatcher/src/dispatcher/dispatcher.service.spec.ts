import { Test, TestingModule } from '@nestjs/testing';
import { JobEntity, JobStatus } from '@scheduler-platform/database';
import { PublisherService } from '@scheduler-platform/rabbitmq';
import { DispatcherService } from './dispatcher.service';
import { DispatcherRepository } from './dispatcher.repository';

describe('DispatcherService', () => {
  let service: DispatcherService;
  let repository: jest.Mocked<DispatcherRepository>;
  let publisherService: jest.Mocked<PublisherService>;

  const mockJob: JobEntity = {
    id: 'job-100',
    scheduleId: 'sched-500',
    status: JobStatus.READY,
    executeAt: new Date('2026-08-02T12:00:00Z'),
    payload: { task: 'send_email' },
    attempt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      fetchAndClaimReadyJobs: jest.fn().mockResolvedValue([]),
      findReadyJobs: jest.fn().mockResolvedValue([]),
      updateJobStatus: jest.fn().mockResolvedValue(undefined),
    };

    const mockPublisher = {
      publish: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatcherService,
        {
          provide: DispatcherRepository,
          useValue: mockRepo,
        },
        {
          provide: PublisherService,
          useValue: mockPublisher,
        },
      ],
    }).compile();

    service = module.get<DispatcherService>(DispatcherService);
    repository = module.get(DispatcherRepository);
    publisherService = module.get(PublisherService);

    // Stop automated polling during unit tests
    service.stopPolling();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('dispatchBatch', () => {
    it('should publish READY job to RabbitMQ', async () => {
      repository.fetchAndClaimReadyJobs.mockResolvedValueOnce([mockJob]);
      publisherService.publish.mockResolvedValueOnce(true);

      const result = await service.dispatchBatch();

      expect(repository.fetchAndClaimReadyJobs).toHaveBeenCalledWith(500);
      expect(publisherService.publish).toHaveBeenCalledWith('scheduler.exchange', 'job.execute', {
        jobId: mockJob.id,
        scheduleId: mockJob.scheduleId,
        workerType: undefined,
        routingKey: 'job.execute',
        priority: 0,
        tenantId: undefined,
        executeAt: mockJob.executeAt.toISOString(),
        payload: mockJob.payload,
      });
      expect(result).toEqual({ fetched: 1, dispatched: 1, failed: 0 });
    });

    it('should revert job status to READY if publish to RabbitMQ fails', async () => {
      repository.fetchAndClaimReadyJobs.mockResolvedValueOnce([mockJob]);
      publisherService.publish.mockRejectedValueOnce(new Error('Broker connection lost'));

      const result = await service.dispatchBatch();

      expect(publisherService.publish).toHaveBeenCalled();
      expect(repository.updateJobStatus).toHaveBeenCalledWith(mockJob.id, JobStatus.READY);
      expect(result).toEqual({ fetched: 1, dispatched: 0, failed: 1 });
    });

    it('should return 0 fetched when no READY jobs exist', async () => {
      repository.fetchAndClaimReadyJobs.mockResolvedValueOnce([]);

      const result = await service.dispatchBatch();

      expect(publisherService.publish).not.toHaveBeenCalled();
      expect(result).toEqual({ fetched: 0, dispatched: 0, failed: 0 });
    });
  });

  describe('metrics', () => {
    it('should accurately report totalDispatched and totalFailed metrics', async () => {
      repository.fetchAndClaimReadyJobs.mockResolvedValueOnce([mockJob]);
      publisherService.publish.mockResolvedValueOnce(true);

      await service.dispatchBatch();

      const metrics = service.getMetrics();
      expect(metrics.totalDispatched).toBe(1);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.lastDispatchTime).toBeInstanceOf(Date);
    });
  });
});

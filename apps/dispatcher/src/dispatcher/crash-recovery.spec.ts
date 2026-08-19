import { Test, TestingModule } from '@nestjs/testing';
import { DispatcherService } from './dispatcher.service';
import { DispatcherRepository } from './dispatcher.repository';
import { PublisherService } from '@scheduler-platform/rabbitmq';
import { ConfigService } from '@nestjs/config';

describe('Dispatcher Crash Recovery & Resilience Tests', () => {
  let dispatcherService: DispatcherService;
  let dispatcherRepo: jest.Mocked<DispatcherRepository>;
  let publisherService: jest.Mocked<PublisherService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatcherService,
        {
          provide: DispatcherRepository,
          useValue: {
            fetchAndClaimReadyJobs: jest.fn(),
            updateJobStatus: jest.fn(),
            recoverStuckJobsBulk: jest.fn(),
          },
        },
        {
          provide: PublisherService,
          useValue: {
            publish: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    dispatcherService = module.get<DispatcherService>(DispatcherService);
    dispatcherRepo = module.get(DispatcherRepository);
    publisherService = module.get(PublisherService);
  });

  it('should recover stuck jobs where worker died or stopped heartbeating', async () => {
    dispatcherRepo.recoverStuckJobsBulk.mockResolvedValue(5);

    const recovered = await dispatcherService.recoverStuckJobs(60000);
    expect(recovered).toBe(5);
    expect(dispatcherRepo.recoverStuckJobsBulk).toHaveBeenCalledWith(60000);
  });

  it('should revert job status back to READY if RabbitMQ publish fails during dispatch', async () => {
    dispatcherRepo.fetchAndClaimReadyJobs.mockResolvedValue([
      {
        id: 'job-1',
        scheduleId: 'sched-1',
        workerType: 'EMAIL',
        executeAt: new Date(),
        priority: 10,
        payload: { to: 'test@example.com' },
      } as any,
    ]);

    publisherService.publish.mockRejectedValue(new Error('RabbitMQ connection reset'));

    const result = await dispatcherService.dispatchBatch();

    expect(result.failed).toBe(1);
    expect(result.dispatched).toBe(0);
    expect(dispatcherRepo.updateJobStatus).toHaveBeenCalledWith('job-1', 'READY');
  });
});

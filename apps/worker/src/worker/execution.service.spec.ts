import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionEntity, ExecutionStatus, JobStatus } from '@scheduler-platform/database';
import { ExecutionService } from './execution.service';
import { ExecutionRepository } from './execution.repository';

describe('ExecutionService', () => {
  let service: ExecutionService;
  let repository: jest.Mocked<ExecutionRepository>;

  const mockExecution: ExecutionEntity = {
    id: 'exec-123',
    jobId: 'job-456',
    attemptNumber: 1,
    status: ExecutionStatus.RUNNING,
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      countExecutionsForJob: jest.fn().mockResolvedValue(0),
      createExecution: jest.fn().mockResolvedValue(mockExecution),
      updateExecutionStatus: jest.fn().mockResolvedValue(undefined),
      updateJobStatus: jest.fn().mockResolvedValue(undefined),
      findJobById: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionService,
        {
          provide: ExecutionRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ExecutionService>(ExecutionService);
    repository = module.get(ExecutionRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startExecution', () => {
    it('should create execution record with RUNNING status and update job status', async () => {
      const result = await service.startExecution('job-456');

      expect(repository.countExecutionsForJob).toHaveBeenCalledWith('job-456');
      expect(repository.createExecution).toHaveBeenCalledWith('job-456', 1);
      expect(repository.updateJobStatus).toHaveBeenCalledWith('job-456', JobStatus.RUNNING, 1);
      expect(result).toBe(mockExecution);
    });
  });

  describe('completeExecution', () => {
    it('should update execution and job status to SUCCEEDED', async () => {
      await service.completeExecution('exec-123', 'job-456');

      expect(repository.updateExecutionStatus).toHaveBeenCalledWith(
        'exec-123',
        ExecutionStatus.SUCCEEDED,
      );
      expect(repository.updateJobStatus).toHaveBeenCalledWith('job-456', JobStatus.SUCCEEDED);

      const metrics = service.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
      expect(metrics.totalSucceeded).toBe(1);
    });
  });

  describe('failExecution', () => {
    it('should update execution and job status to FAILED with error message', async () => {
      await service.failExecution('exec-123', 'job-456', 'Timeout error');

      expect(repository.updateExecutionStatus).toHaveBeenCalledWith(
        'exec-123',
        ExecutionStatus.FAILED,
        expect.any(Date),
        'Timeout error',
        undefined,
      );
      expect(repository.updateJobStatus).toHaveBeenCalledWith('job-456', JobStatus.FAILED);

      const metrics = service.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
      expect(metrics.totalFailed).toBe(1);
    });
  });
});

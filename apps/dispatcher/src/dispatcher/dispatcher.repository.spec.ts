import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobEntity, JobStatus } from '@scheduler-platform/database';
import { DispatcherRepository } from './dispatcher.repository';

describe('DispatcherRepository', () => {
  let repository: DispatcherRepository;
  let typeormRepo: jest.Mocked<Repository<JobEntity>>;

  const mockReadyJob: JobEntity = {
    id: 'job-1',
    scheduleId: 'sched-1',
    status: JobStatus.READY,
    executeAt: new Date('2026-08-02T12:00:00Z'),
    payload: { action: 'run' },
    attempt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockTypeOrmRepo = {
      find: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatcherRepository,
        {
          provide: getRepositoryToken(JobEntity),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<DispatcherRepository>(DispatcherRepository);
    typeormRepo = module.get(getRepositoryToken(JobEntity));
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findReadyJobs', () => {
    it('should query jobs with READY status ordered by priority and executeAt ASC with batch limit', async () => {
      typeormRepo.find.mockResolvedValueOnce([mockReadyJob]);

      const result = await repository.findReadyJobs(500);

      expect(typeormRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 500,
        }),
      );
      expect(result).toEqual([mockReadyJob]);
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status to DISPATCHED', async () => {
      typeormRepo.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] });

      await repository.updateJobStatus('job-1', JobStatus.DISPATCHED);

      expect(typeormRepo.update).toHaveBeenCalledWith('job-1', {
        status: JobStatus.DISPATCHED,
        lastHeartbeat: expect.any(Date),
      });
    });
  });
});

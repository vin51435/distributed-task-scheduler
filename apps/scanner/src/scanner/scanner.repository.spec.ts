import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  ScheduleEntity,
  ScheduleStatus,
  ScheduleType,
  JobEntity,
  JobStatus,
} from '@scheduler-platform/database';
import { ScannerRepository } from './scanner.repository';

describe('ScannerRepository', () => {
  let repository: ScannerRepository;
  let scheduleRepo: jest.Mocked<Repository<ScheduleEntity>>;
  let jobRepo: jest.Mocked<Repository<JobEntity>>;

  const mockSchedule: ScheduleEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Schedule',
    type: ScheduleType.CRON,
    cron: '0 * * * *',
    nextExecuteAt: new Date('2026-08-02T12:00:00Z'),
    timezone: 'UTC',
    payload: { action: 'test' },
    status: ScheduleStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJob: JobEntity = {
    id: 'job-123',
    scheduleId: mockSchedule.id,
    status: JobStatus.READY,
    executeAt: mockSchedule.nextExecuteAt!,
    payload: mockSchedule.payload,
    attempt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockScheduleTypeOrm = {
      find: jest.fn().mockResolvedValue([mockSchedule]),
      findOne: jest.fn().mockResolvedValue(mockSchedule),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const mockJobTypeOrm = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue(mockJob),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScannerRepository,
        {
          provide: getRepositoryToken(ScheduleEntity),
          useValue: mockScheduleTypeOrm,
        },
        {
          provide: getRepositoryToken(JobEntity),
          useValue: mockJobTypeOrm,
        },
      ],
    }).compile();

    repository = module.get<ScannerRepository>(ScannerRepository);
    scheduleRepo = module.get(getRepositoryToken(ScheduleEntity));
    jobRepo = module.get(getRepositoryToken(JobEntity));
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findDueSchedules', () => {
    it('should query schedules with status ACTIVE, nextExecuteAt <= now and limit by batchSize', async () => {
      const now = new Date('2026-08-02T13:00:00Z');
      const result = await repository.findDueSchedules(now, 100);

      expect(scheduleRepo.find).toHaveBeenCalledWith({
        where: {
          status: ScheduleStatus.ACTIVE,
          nextExecuteAt: LessThanOrEqual(now),
        },
        order: { nextExecuteAt: 'ASC' },
        take: 100,
      });
      expect(result).toEqual([mockSchedule]);
    });
  });

  describe('createJob', () => {
    it('should create and save a new Job entity', async () => {
      const jobData: Partial<JobEntity> = {
        scheduleId: mockSchedule.id,
        status: JobStatus.READY,
        executeAt: mockSchedule.nextExecuteAt,
        payload: mockSchedule.payload,
        attempt: 0,
      };

      const result = await repository.createJob(jobData);
      expect(jobRepo.create).toHaveBeenCalledWith(jobData);
      expect(jobRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockJob);
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule fields and return updated entity', async () => {
      const updateData = { status: ScheduleStatus.COMPLETED };
      const result = await repository.updateSchedule(mockSchedule.id, updateData);

      expect(scheduleRepo.update).toHaveBeenCalledWith(mockSchedule.id, updateData);
      expect(scheduleRepo.findOne).toHaveBeenCalledWith({ where: { id: mockSchedule.id } });
      expect(result).toEqual(mockSchedule);
    });
  });
});

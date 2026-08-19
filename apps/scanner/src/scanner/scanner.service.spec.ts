import { Test, TestingModule } from '@nestjs/testing';
import {
  ScheduleEntity,
  ScheduleStatus,
  ScheduleType,
  JobEntity,
  JobStatus,
} from '@scheduler-platform/database';
import { ScannerService } from './scanner.service';
import { ScannerRepository } from './scanner.repository';

describe('ScannerService', () => {
  let service: ScannerService;
  let repository: jest.Mocked<ScannerRepository>;

  const mockOneOffSchedule: ScheduleEntity = {
    id: 'one-off-123',
    name: 'One Off Schedule',
    type: ScheduleType.ONE_OFF,
    nextExecuteAt: new Date('2026-08-02T10:00:00Z'),
    timezone: 'UTC',
    payload: { task: 'one_off_task' },
    status: ScheduleStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCronSchedule: ScheduleEntity = {
    id: 'cron-456',
    name: 'Cron Schedule',
    type: ScheduleType.CRON,
    cron: '0 * * * *',
    nextExecuteAt: new Date('2026-08-02T10:00:00Z'),
    timezone: 'UTC',
    payload: { task: 'cron_task' },
    status: ScheduleStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJob: JobEntity = {
    id: 'job-1',
    scheduleId: 'one-off-123',
    status: JobStatus.READY,
    executeAt: new Date('2026-08-02T10:00:00Z'),
    payload: { task: 'one_off_task' },
    attempt: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      findDueSchedules: jest.fn().mockResolvedValue([]),
      createJob: jest.fn().mockResolvedValue(mockJob),
      updateSchedule: jest.fn().mockResolvedValue(mockOneOffSchedule),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScannerService,
        {
          provide: ScannerRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ScannerService>(ScannerService);
    repository = module.get(ScannerRepository);

    // Stop polling during unit tests to avoid timers interfering
    service.stopPolling();
  });

  afterEach(() => {
    service.stopPolling();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scan', () => {
    it('should create 1 job and mark ONE_OFF schedule as COMPLETED', async () => {
      repository.findDueSchedules.mockResolvedValueOnce([mockOneOffSchedule]);

      const now = new Date('2026-08-02T10:05:00Z');
      const result = await service.scan(now);

      expect(repository.findDueSchedules).toHaveBeenCalledWith(now, 500, undefined);
      expect(repository.createJob).toHaveBeenCalledWith({
        scheduleId: mockOneOffSchedule.id,
        status: JobStatus.READY,
        executeAt: mockOneOffSchedule.nextExecuteAt,
        payload: mockOneOffSchedule.payload,
        attempt: 0,
        maxAttempts: 5,
        retryPolicy: undefined,
        workerType: undefined,
        routingKey: undefined,
        priority: 0,
        tenantId: undefined,
      });
      expect(repository.updateSchedule).toHaveBeenCalledWith(mockOneOffSchedule.id, {
        status: ScheduleStatus.COMPLETED,
      });
      expect(result).toMatchObject({ scannedSchedules: 1, jobsCreated: 1 });
    });

    it('should create 1 job and update nextExecuteAt for CRON schedule', async () => {
      repository.findDueSchedules.mockResolvedValueOnce([mockCronSchedule]);

      const now = new Date('2026-08-02T10:05:00Z');
      const result = await service.scan(now);

      expect(repository.createJob).toHaveBeenCalledWith({
        scheduleId: mockCronSchedule.id,
        status: JobStatus.READY,
        executeAt: mockCronSchedule.nextExecuteAt,
        payload: mockCronSchedule.payload,
        attempt: 0,
        maxAttempts: 5,
        retryPolicy: undefined,
        workerType: undefined,
        routingKey: undefined,
        priority: 0,
        tenantId: undefined,
      });
      expect(repository.updateSchedule).toHaveBeenCalledWith(
        mockCronSchedule.id,
        expect.objectContaining({
          nextExecuteAt: expect.any(Date),
        }),
      );

      // Verify that nextExecuteAt is calculated correctly (1 hour later for '0 * * * *')
      const updatedScheduleArg = repository.updateSchedule.mock.calls[0][1];
      expect(updatedScheduleArg.nextExecuteAt?.getTime()).toBeGreaterThan(
        mockCronSchedule.nextExecuteAt!.getTime(),
      );
      expect(result).toMatchObject({ scannedSchedules: 1, jobsCreated: 1 });
    });

    it('should return 0 scanned and 0 jobs created when no schedules are due', async () => {
      repository.findDueSchedules.mockResolvedValueOnce([]);

      const result = await service.scan();
      expect(repository.createJob).not.toHaveBeenCalled();
      expect(repository.updateSchedule).not.toHaveBeenCalled();
      expect(result).toMatchObject({ scannedSchedules: 0, jobsCreated: 0 });
    });
  });

  describe('metrics', () => {
    it('should accurately track total scans and jobs created', async () => {
      repository.findDueSchedules.mockResolvedValueOnce([mockOneOffSchedule]);

      await service.scan();

      const metrics = service.getMetrics();
      expect(metrics.totalScans).toBe(1);
      expect(metrics.jobsCreated).toBe(1);
      expect(metrics.batchSize).toBe(500);
      expect(metrics.lastScanTime).toBeInstanceOf(Date);
    });
  });
});

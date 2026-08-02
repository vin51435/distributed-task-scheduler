import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleRepository } from './schedule.repository';
import { ScheduleEntity, ScheduleStatus, ScheduleType } from './entities/schedule.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let repository: jest.Mocked<ScheduleRepository>;

  const mockSchedule: ScheduleEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Schedule',
    description: 'Test Description',
    type: ScheduleType.CRON,
    cron: '0 * * * *',
    timezone: 'UTC',
    payload: { task: 'test' },
    status: ScheduleStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn().mockResolvedValue(mockSchedule),
      findById: jest.fn().mockResolvedValue(mockSchedule),
      findAll: jest.fn().mockResolvedValue([mockSchedule]),
      update: jest.fn().mockResolvedValue(mockSchedule),
      delete: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        {
          provide: ScheduleRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    repository = module.get(ScheduleRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSchedule', () => {
    it('should create a CRON schedule', async () => {
      const dto: CreateScheduleDto = {
        name: 'Test Schedule',
        type: ScheduleType.CRON,
        cron: '0 * * * *',
        payload: { task: 'test' },
      };

      const result = await service.createSchedule(dto);
      expect(repository.create).toHaveBeenCalled();
      expect(result).toEqual(mockSchedule);
    });

    it('should throw BadRequestException if CRON schedule has no cron expression', async () => {
      const dto: CreateScheduleDto = {
        name: 'Invalid Schedule',
        type: ScheduleType.CRON,
        payload: { task: 'test' },
      };

      await expect(service.createSchedule(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if ONE_OFF schedule has no executeAt', async () => {
      const dto: CreateScheduleDto = {
        name: 'Invalid Schedule',
        type: ScheduleType.ONE_OFF,
        payload: { task: 'test' },
      };

      await expect(service.createSchedule(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getScheduleById', () => {
    it('should return a schedule by id', async () => {
      const result = await service.getScheduleById('123e4567-e89b-12d3-a456-426614174000');
      expect(result).toEqual(mockSchedule);
    });

    it('should throw NotFoundException if schedule does not exist', async () => {
      repository.findById.mockResolvedValueOnce(null);
      await expect(service.getScheduleById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      await expect(
        service.deleteSchedule('123e4567-e89b-12d3-a456-426614174000'),
      ).resolves.not.toThrow();
      expect(repository.delete).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should throw NotFoundException if schedule to delete does not exist', async () => {
      repository.delete.mockResolvedValueOnce(false);
      await expect(service.deleteSchedule('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});

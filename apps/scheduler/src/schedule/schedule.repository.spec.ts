import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleRepository } from './schedule.repository';
import { ScheduleEntity, ScheduleStatus, ScheduleType } from './entities/schedule.entity';

describe('ScheduleRepository', () => {
  let repository: ScheduleRepository;
  let typeormRepo: jest.Mocked<Repository<ScheduleEntity>>;

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
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue(mockSchedule),
      findOne: jest.fn().mockResolvedValue(mockSchedule),
      find: jest.fn().mockResolvedValue([mockSchedule]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleRepository,
        {
          provide: getRepositoryToken(ScheduleEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    repository = module.get<ScheduleRepository>(ScheduleRepository);
    typeormRepo = module.get(getRepositoryToken(ScheduleEntity));
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a schedule entity', async () => {
      const result = await repository.create(mockSchedule);
      expect(typeormRepo.create).toHaveBeenCalledWith(mockSchedule);
      expect(typeormRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockSchedule);
    });
  });

  describe('findById', () => {
    it('should return a schedule by id', async () => {
      const result = await repository.findById('123e4567-e89b-12d3-a456-426614174000');
      expect(typeormRepo.findOne).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
      });
      expect(result).toEqual(mockSchedule);
    });
  });

  describe('findAll', () => {
    it('should return an array of schedules', async () => {
      const result = await repository.findAll();
      expect(typeormRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
      expect(result).toEqual([mockSchedule]);
    });
  });

  describe('update', () => {
    it('should update and return the schedule', async () => {
      const result = await repository.update('123e4567-e89b-12d3-a456-426614174000', {
        name: 'Updated',
      });
      expect(typeormRepo.update).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', {
        name: 'Updated',
      });
      expect(result).toEqual(mockSchedule);
    });
  });

  describe('delete', () => {
    it('should return true when delete affects a row', async () => {
      const result = await repository.delete('123e4567-e89b-12d3-a456-426614174000');
      expect(typeormRepo.delete).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(result).toBe(true);
    });
  });
});

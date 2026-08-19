import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { ScheduleEntity, ScheduleStatus, ScheduleType } from './entities/schedule.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';

describe('ScheduleController', () => {
  let controller: ScheduleController;
  let service: jest.Mocked<ScheduleService>;

  const mockSchedule: ScheduleEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Schedule',
    description: 'Test Description',
    type: ScheduleType.CRON,
    cron: '0 * * * *',
    nextExecuteAt: new Date('2026-08-02T12:00:00Z'),
    timezone: 'UTC',
    payload: { task: 'test' },
    status: ScheduleStatus.ACTIVE,
    createdAt: new Date('2026-08-02T12:00:00Z'),
    updatedAt: new Date('2026-08-02T12:00:00Z'),
  };

  beforeEach(async () => {
    const mockService = {
      createSchedule: jest.fn().mockResolvedValue(mockSchedule),
      getSchedules: jest.fn().mockResolvedValue([mockSchedule]),
      getScheduleById: jest.fn().mockResolvedValue(mockSchedule),
      updateSchedule: jest.fn().mockResolvedValue(mockSchedule),
      deleteSchedule: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduleController],
      providers: [
        {
          provide: ScheduleService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ScheduleController>(ScheduleController);
    service = module.get(ScheduleService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a schedule and return DTO', async () => {
      const dto: CreateScheduleDto = {
        name: 'Test Schedule',
        type: ScheduleType.CRON,
        cron: '0 * * * *',
        payload: { task: 'test' },
      };

      const result = await controller.create(dto);
      expect(service.createSchedule).toHaveBeenCalledWith(dto, undefined);
      expect(result.id).toEqual(mockSchedule.id);
      expect(result.name).toEqual(mockSchedule.name);
    });
  });

  describe('findAll', () => {
    it('should return list of schedules', async () => {
      const result = await controller.findAll();
      expect(service.getSchedules).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(mockSchedule.id);
    });
  });

  describe('findOne', () => {
    it('should return schedule by id', async () => {
      const result = await controller.findOne('123e4567-e89b-12d3-a456-426614174000');
      expect(service.getScheduleById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(result.id).toEqual(mockSchedule.id);
    });
  });

  describe('update', () => {
    it('should update and return schedule', async () => {
      const result = await controller.update('123e4567-e89b-12d3-a456-426614174000', {
        name: 'Updated',
      });
      expect(service.updateSchedule).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', {
        name: 'Updated',
      });
      expect(result.id).toEqual(mockSchedule.id);
    });
  });

  describe('remove', () => {
    it('should delete schedule', async () => {
      await controller.remove('123e4567-e89b-12d3-a456-426614174000');
      expect(service.deleteSchedule).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    });
  });
});

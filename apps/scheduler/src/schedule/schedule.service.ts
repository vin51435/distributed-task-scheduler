import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ScheduleRepository } from './schedule.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleEntity, ScheduleType } from './entities/schedule.entity';

@Injectable()
export class ScheduleService {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async createSchedule(dto: CreateScheduleDto): Promise<ScheduleEntity> {
    this.validateScheduleTypeRules(dto.type, dto.cron, dto.executeAt);

    return this.scheduleRepository.create({
      name: dto.name,
      description: dto.description,
      type: dto.type,
      cron: dto.cron,
      executeAt: dto.executeAt ? new Date(dto.executeAt) : undefined,
      timezone: dto.timezone ?? 'UTC',
      payload: dto.payload,
      status: dto.status,
    });
  }

  async getSchedules(): Promise<ScheduleEntity[]> {
    return this.scheduleRepository.findAll();
  }

  async getScheduleById(id: string): Promise<ScheduleEntity> {
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID "${id}" not found`);
    }
    return schedule;
  }

  async updateSchedule(id: string, dto: UpdateScheduleDto): Promise<ScheduleEntity> {
    const existing = await this.getScheduleById(id);

    const targetType = dto.type ?? existing.type;
    const targetCron = dto.cron !== undefined ? dto.cron : existing.cron;
    const targetExecuteAt =
      dto.executeAt !== undefined ? dto.executeAt : existing.executeAt?.toISOString();

    this.validateScheduleTypeRules(targetType, targetCron, targetExecuteAt);

    const updated = await this.scheduleRepository.update(id, {
      ...dto,
      executeAt: dto.executeAt ? new Date(dto.executeAt) : undefined,
    });

    if (!updated) {
      throw new NotFoundException(`Schedule with ID "${id}" not found`);
    }

    return updated;
  }

  async deleteSchedule(id: string): Promise<void> {
    const deleted = await this.scheduleRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Schedule with ID "${id}" not found`);
    }
  }

  private validateScheduleTypeRules(type: ScheduleType, cron?: string, executeAt?: string | Date) {
    if (type === ScheduleType.CRON && !cron) {
      throw new BadRequestException('Schedule of type CRON requires a valid cron expression');
    }
    if (type === ScheduleType.ONE_OFF && !executeAt) {
      throw new BadRequestException('Schedule of type ONE_OFF requires an executeAt timestamp');
    }
  }
}

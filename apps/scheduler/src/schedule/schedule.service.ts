import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { ScheduleRepository } from './schedule.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleEntity, ScheduleType, ScheduleStatus } from './entities/schedule.entity';

@Injectable()
export class ScheduleService {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async createSchedule(dto: CreateScheduleDto): Promise<ScheduleEntity> {
    this.validateScheduleTypeRules(dto.type, dto.cron, dto.executeAt);

    let nextExecuteAt: Date | undefined;
    const timezone = dto.timezone ?? 'UTC';

    if (dto.type === ScheduleType.ONE_OFF && dto.executeAt) {
      nextExecuteAt = new Date(dto.executeAt);
    } else if (dto.type === ScheduleType.CRON && dto.cron) {
      try {
        const interval = CronExpressionParser.parse(dto.cron, { tz: timezone });
        nextExecuteAt = interval.next().toDate();
      } catch (err: any) {
        throw new BadRequestException(`Invalid cron expression "${dto.cron}": ${err.message}`);
      }
    }

    return this.scheduleRepository.create({
      name: dto.name,
      description: dto.description,
      type: dto.type,
      cron: dto.cron,
      nextExecuteAt,
      timezone,
      payload: dto.payload,
      status: dto.status ?? ScheduleStatus.ACTIVE,
      workerType: dto.workerType,
      routingKey: dto.routingKey,
      priority: dto.priority,
      tenantId: dto.tenantId,
      maxAttempts: dto.maxAttempts,
      retryPolicy: dto.retryPolicy,
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
      dto.executeAt !== undefined ? dto.executeAt : existing.nextExecuteAt?.toISOString();
    const targetTimezone = dto.timezone ?? existing.timezone;

    this.validateScheduleTypeRules(targetType, targetCron, targetExecuteAt);

    let nextExecuteAt: Date | undefined = existing.nextExecuteAt;
    if (dto.executeAt !== undefined && targetType === ScheduleType.ONE_OFF) {
      nextExecuteAt = dto.executeAt ? new Date(dto.executeAt) : undefined;
    } else if (
      (dto.cron !== undefined || dto.timezone !== undefined) &&
      targetType === ScheduleType.CRON &&
      targetCron
    ) {
      try {
        const interval = CronExpressionParser.parse(targetCron, { tz: targetTimezone });
        nextExecuteAt = interval.next().toDate();
      } catch (err: any) {
        throw new BadRequestException(`Invalid cron expression "${targetCron}": ${err.message}`);
      }
    }

    const updated = await this.scheduleRepository.update(id, {
      ...dto,
      nextExecuteAt,
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

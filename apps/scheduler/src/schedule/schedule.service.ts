import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronExpressionParser } from 'cron-parser';
import { ScheduleRepository } from './schedule.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import {
  ScheduleEntity,
  ScheduleType,
  ScheduleStatus,
  TenantLimitsEntity,
} from '@scheduler/database';
import { calculateBucket } from '@scheduler/redis';
import { MetricsService } from '@scheduler-platform/metrics';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    @Optional()
    @InjectRepository(TenantLimitsEntity)
    private readonly limitsRepo?: Repository<TenantLimitsEntity>,
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  async createSchedule(dto: CreateScheduleDto, tenantId?: string): Promise<ScheduleEntity> {
    const effectiveTenantId = dto.tenantId || tenantId;
    if (effectiveTenantId && this.limitsRepo) {
      await this.enforceScheduleQuota(effectiveTenantId, 1);
    }

    const entityData = this.prepareScheduleEntity(dto, effectiveTenantId);
    const created = await this.scheduleRepository.create(entityData);
    this.metricsService?.schedulerRequestsTotal.inc({ method: 'POST', status: '201' });
    return created;
  }

  async createBatchSchedules(
    dtos: CreateScheduleDto[],
    tenantId?: string,
  ): Promise<{ created: number; schedules: ScheduleEntity[] }> {
    if (!dtos || dtos.length === 0) {
      throw new BadRequestException('Schedule batch must contain at least 1 item');
    }
    if (dtos.length > 1000) {
      throw new BadRequestException('Batch size cannot exceed 1000 schedules per request');
    }

    const effectiveTenantId = tenantId || dtos[0]?.tenantId;
    if (effectiveTenantId && this.limitsRepo) {
      await this.enforceScheduleQuota(effectiveTenantId, dtos.length);
    }

    const entitiesData = dtos.map((dto) => this.prepareScheduleEntity(dto, effectiveTenantId));
    const saved = await this.scheduleRepository.createMany(entitiesData);

    return {
      created: saved.length,
      schedules: saved,
    };
  }

  async getSchedules(tenantId?: string): Promise<ScheduleEntity[]> {
    return this.scheduleRepository.findAll(tenantId);
  }

  async getScheduleById(id: string): Promise<ScheduleEntity> {
    const schedule = await this.scheduleRepository.findById(id);
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID "${id}" not found`);
    }
    return schedule;
  }

  async pauseSchedule(id: string): Promise<ScheduleEntity> {
    const updated = await this.scheduleRepository.update(id, {
      status: ScheduleStatus.PAUSED,
    });
    if (!updated) {
      throw new NotFoundException(`Schedule with ID "${id}" not found`);
    }
    return updated;
  }

  async resumeSchedule(id: string): Promise<ScheduleEntity> {
    const existing = await this.getScheduleById(id);
    let nextExecuteAt = existing.nextExecuteAt;

    if (existing.type === ScheduleType.CRON && existing.cron) {
      try {
        const interval = CronExpressionParser.parse(existing.cron, {
          tz: existing.timezone || 'UTC',
        });
        nextExecuteAt = interval.next().toDate();
      } catch (err: any) {
        throw new BadRequestException(`Invalid cron expression "${existing.cron}": ${err.message}`);
      }
    }

    const updated = await this.scheduleRepository.update(id, {
      status: ScheduleStatus.ACTIVE,
      nextExecuteAt,
    });

    if (!updated) {
      throw new NotFoundException(`Schedule with ID "${id}" not found`);
    }
    return updated;
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

  private prepareScheduleEntity(
    dto: CreateScheduleDto,
    tenantId?: string,
  ): Partial<ScheduleEntity> {
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

    return {
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
      priority: dto.priority ?? 50,
      tenantId: dto.tenantId || tenantId,
      maxAttempts: dto.maxAttempts,
      retryPolicy: dto.retryPolicy,
      bucket: calculateBucket(dto.name),
    };
  }

  private async enforceScheduleQuota(tenantId: string, additionalCount: number) {
    if (!this.limitsRepo) return;
    const limits = await this.limitsRepo.findOne({ where: { tenantId } });
    if (!limits) return;

    const currentCount = await this.scheduleRepository.countByTenant(tenantId);
    if (currentCount + additionalCount > limits.maxSchedules) {
      throw new ForbiddenException(
        `Tenant quota exceeded: current schedules (${currentCount}) + requested (${additionalCount}) > max allowed (${limits.maxSchedules})`,
      );
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

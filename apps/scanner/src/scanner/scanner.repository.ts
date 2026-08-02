import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ScheduleEntity, ScheduleStatus, JobEntity } from '@scheduler/database';

@Injectable()
export class ScannerRepository {
  constructor(
    @InjectRepository(ScheduleEntity)
    private readonly scheduleRepo: Repository<ScheduleEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
  ) {}

  async findDueSchedules(
    now: Date = new Date(),
    batchSize: number = 500,
  ): Promise<ScheduleEntity[]> {
    return this.scheduleRepo.find({
      where: {
        status: ScheduleStatus.ACTIVE,
        nextExecuteAt: LessThanOrEqual(now),
      },
      order: { nextExecuteAt: 'ASC' },
      take: batchSize,
    });
  }

  async createJob(data: Partial<JobEntity>): Promise<JobEntity> {
    const job = this.jobRepo.create(data);
    return this.jobRepo.save(job);
  }

  async updateSchedule(id: string, data: Partial<ScheduleEntity>): Promise<ScheduleEntity | null> {
    await this.scheduleRepo.update(id, data);
    return this.scheduleRepo.findOne({ where: { id } });
  }
}

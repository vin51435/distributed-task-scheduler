import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobEntity } from '@scheduler-platform/database';

@Injectable()
export class JobRepository {
  constructor(
    @InjectRepository(JobEntity)
    private readonly repo: Repository<JobEntity>,
  ) {}

  async create(data: Partial<JobEntity>): Promise<JobEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<JobEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByScheduleId(scheduleId: string): Promise<JobEntity[]> {
    return this.repo.find({ where: { scheduleId }, order: { createdAt: 'DESC' } });
  }

  async count(): Promise<number> {
    return this.repo.count();
  }
}

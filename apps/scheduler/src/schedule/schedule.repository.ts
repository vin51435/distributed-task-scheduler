import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleEntity } from './entities/schedule.entity';

@Injectable()
export class ScheduleRepository {
  constructor(
    @InjectRepository(ScheduleEntity)
    private readonly repo: Repository<ScheduleEntity>,
  ) {}

  async create(data: Partial<ScheduleEntity>): Promise<ScheduleEntity> {
    const entity = this.repo.create(data);
    return await this.repo.save(entity);
  }

  async createMany(data: Partial<ScheduleEntity>[]): Promise<ScheduleEntity[]> {
    const entities = this.repo.create(data);
    return await this.repo.save(entities);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return await this.repo.count({ where: { tenantId } });
  }

  async findById(id: string): Promise<ScheduleEntity | null> {
    return await this.repo.findOne({ where: { id } });
  }

  async findAll(tenantId?: string): Promise<ScheduleEntity[]> {
    return await this.repo.find({
      where: tenantId ? { tenantId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, data: Partial<ScheduleEntity>): Promise<ScheduleEntity | null> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}

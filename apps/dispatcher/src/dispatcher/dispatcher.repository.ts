import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobEntity, JobStatus } from '@scheduler/database';

@Injectable()
export class DispatcherRepository {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
  ) {}

  async findReadyJobs(limit: number): Promise<JobEntity[]> {
    return this.jobRepository.find({
      where: { status: JobStatus.READY },
      order: { executeAt: 'ASC' },
      take: limit,
    });
  }

  async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    await this.jobRepository.update(jobId, { status });
  }
}

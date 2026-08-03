import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, IsNull, Or, Repository } from 'typeorm';
import { JobEntity, JobStatus } from '@scheduler/database';

@Injectable()
export class DispatcherRepository {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
  ) {}

  async findReadyJobs(limit: number, now: Date = new Date()): Promise<JobEntity[]> {
    return this.jobRepository.find({
      where: [
        { status: JobStatus.READY, executeAt: LessThanOrEqual(now), nextRetryAt: IsNull() },
        {
          status: JobStatus.READY,
          executeAt: LessThanOrEqual(now),
          nextRetryAt: LessThanOrEqual(now),
        },
      ],
      order: { priority: 'DESC', executeAt: 'ASC' },
      take: limit,
    });
  }

  async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    await this.jobRepository.update(jobId, {
      status,
      ...(status === JobStatus.DISPATCHED ? { lastHeartbeat: new Date() } : {}),
    });
  }

  async findStuckJobs(timeoutMs = 60000, now: Date = new Date()): Promise<JobEntity[]> {
    const threshold = new Date(now.getTime() - timeoutMs);

    return this.jobRepository
      .createQueryBuilder('job')
      .where('job.status IN (:...statuses)', {
        statuses: [JobStatus.RUNNING, JobStatus.DISPATCHED],
      })
      .andWhere('(job.lastHeartbeat IS NULL OR job.lastHeartbeat <= :threshold)', { threshold })
      .andWhere('job.updatedAt <= :threshold', { threshold })
      .getMany();
  }

  async recoverStuckJob(
    jobId: string,
    errorMessage = 'Visibility timeout expired: Worker lost or crashed',
  ): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: JobStatus.READY,
      lastError: errorMessage,
      failureReason: 'VISIBILITY_TIMEOUT',
      lastHeartbeat: null,
    });
  }
}

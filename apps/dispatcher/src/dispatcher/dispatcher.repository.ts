import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, IsNull, Repository } from 'typeorm';
import { JobEntity, JobStatus } from '@scheduler/database';

@Injectable()
export class DispatcherRepository {
  private readonly logger = new Logger(DispatcherRepository.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
  ) {}

  /**
   * Atomically claims ready jobs using PostgreSQL 'FOR UPDATE SKIP LOCKED'.
   * Ensures concurrent Dispatcher instances claim non-overlapping job batches instantly.
   */
  async fetchAndClaimReadyJobs(limit: number, now: Date = new Date()): Promise<JobEntity[]> {
    const rawQuery = `
      UPDATE jobs
      SET status = $1, last_heartbeat = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT id FROM jobs
        WHERE (status = $3 AND execute_at <= $4 AND (next_retry_at IS NULL OR next_retry_at <= $4))
           OR (status = $3 AND execute_at <= $4 AND next_retry_at <= $4)
        ORDER BY priority DESC, execute_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $5
      )
      RETURNING *;
    `;

    try {
      const rawResults = await this.jobRepository.query(rawQuery, [
        JobStatus.DISPATCHED,
        now,
        JobStatus.READY,
        now,
        limit,
      ]);

      if (Array.isArray(rawResults) && rawResults.length > 0) {
        return rawResults.map((r: any) => this.mapRawToJobEntity(r));
      }
      return [];
    } catch (err: any) {
      this.logger.warn(
        `FOR UPDATE SKIP LOCKED raw query failed: ${err.message}. Falling back to standard query.`,
      );
      return this.findReadyJobs(limit, now);
    }
  }

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

  private mapRawToJobEntity(r: any): JobEntity {
    const entity = new JobEntity();
    entity.id = r.id;
    entity.createdAt = r.created_at ? new Date(r.created_at) : new Date();
    entity.updatedAt = r.updated_at ? new Date(r.updated_at) : new Date();
    entity.scheduleId = r.schedule_id;
    entity.status = r.status;
    entity.executeAt = r.execute_at ? new Date(r.execute_at) : new Date();
    entity.payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
    entity.attempt = r.attempt;
    entity.maxAttempts = r.max_attempts;
    entity.retryPolicy = r.retry_policy;
    entity.nextRetryAt = r.next_retry_at ? new Date(r.next_retry_at) : undefined;
    entity.lastError = r.last_error;
    entity.failureReason = r.failure_reason;
    entity.lastHeartbeat = r.last_heartbeat ? new Date(r.last_heartbeat) : undefined;
    entity.workerType = r.worker_type;
    entity.routingKey = r.routing_key;
    entity.priority = r.priority;
    entity.tenantId = r.tenant_id;
    return entity;
  }
}

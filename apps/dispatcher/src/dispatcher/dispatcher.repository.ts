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
    const row = Array.isArray(r) ? r[0] : r;
    const entity = new JobEntity();
    entity.id = row.id || row.Id || row.ID;
    entity.createdAt =
      row.created_at || row.createdAt ? new Date(row.created_at || row.createdAt) : new Date();
    entity.updatedAt =
      row.updated_at || row.updatedAt ? new Date(row.updated_at || row.updatedAt) : new Date();
    entity.scheduleId = row.schedule_id || row.scheduleId;
    entity.status = row.status;
    entity.executeAt =
      row.execute_at || row.executeAt ? new Date(row.execute_at || row.executeAt) : new Date();
    entity.payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
    entity.attempt = Number(row.attempt || 0);
    entity.maxAttempts = Number(row.max_attempts || row.maxAttempts || 5);
    entity.retryPolicy = row.retry_policy || row.retryPolicy;
    entity.nextRetryAt =
      row.next_retry_at || row.nextRetryAt
        ? new Date(row.next_retry_at || row.nextRetryAt)
        : undefined;
    entity.lastError = row.last_error || row.lastError;
    entity.failureReason = row.failure_reason || row.failureReason;
    entity.lastHeartbeat =
      row.last_heartbeat || row.lastHeartbeat
        ? new Date(row.last_heartbeat || row.lastHeartbeat)
        : undefined;
    entity.workerType = row.worker_type || row.workerType;
    entity.routingKey = row.routing_key || row.routingKey;
    entity.priority = Number(row.priority || 0);
    entity.tenantId = row.tenant_id || row.tenantId;
    return entity;
  }
}

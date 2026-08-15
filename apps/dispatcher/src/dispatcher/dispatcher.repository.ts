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
    const staleDispatchedThreshold = new Date(now.getTime() - 15000); // 15 seconds visibility threshold
    const rawQuery = `
      UPDATE jobs
      SET status = $1, last_heartbeat = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT id FROM jobs
        WHERE (status = $3 AND execute_at <= $4 AND (next_retry_at IS NULL OR next_retry_at <= $4))
           OR (status = $1 AND (last_heartbeat IS NULL OR last_heartbeat <= $5))
        ORDER BY priority DESC, execute_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $6
      )
      RETURNING *;
    `;

    try {
      const rawResults = await this.jobRepository.query(rawQuery, [
        JobStatus.DISPATCHED,
        now,
        JobStatus.READY,
        now,
        staleDispatchedThreshold,
        limit,
      ]);

      // Handle Postgres [rows, count] format or direct array of rows
      let rows: any[] = [];
      if (Array.isArray(rawResults)) {
        if (Array.isArray(rawResults[0])) {
          rows = rawResults[0];
        } else if (
          rawResults.length > 0 &&
          typeof rawResults[0] === 'object' &&
          rawResults[0] !== null &&
          !Array.isArray(rawResults[0])
        ) {
          rows = rawResults;
        }
      }

      if (rows.length > 0) {
        return rows
          .filter((r) => r && typeof r === 'object')
          .map((r: any) => this.mapRawToJobEntity(r));
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

  async recoverStuckJobsBulk(timeoutMs = 60000, now: Date = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - timeoutMs);
    const rawQuery = `
      UPDATE jobs
      SET status = $1,
          last_error = $2,
          failure_reason = $3,
          last_heartbeat = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE status IN ($4, $5)
        AND (last_heartbeat IS NULL OR last_heartbeat <= $6)
        AND updated_at <= $6;
    `;

    try {
      const result = await this.jobRepository.query(rawQuery, [
        JobStatus.READY,
        'Visibility timeout expired: Worker lost or crashed',
        'VISIBILITY_TIMEOUT',
        JobStatus.RUNNING,
        JobStatus.DISPATCHED,
        threshold,
      ]);

      if (Array.isArray(result) && result[1] !== undefined) {
        return Number(result[1]);
      }
      return Number(result?.affected || 0);
    } catch (err: any) {
      this.logger.error(`Failed bulk stuck job recovery query: ${err.message}`);
      return 0;
    }
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
    if (!r) return new JobEntity();
    const row = Array.isArray(r) ? r[0] : r;
    if (!row || typeof row !== 'object') return new JobEntity();
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

# Chapter 11 — PostgreSQL Data Model & Timer Store Design

**Document:** Distributed Task Scheduler Platform
**Chapter:** 11
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why PostgreSQL?
3. Timer Store Responsibilities
4. Data Ownership
5. Database Architecture
6. Core Tables
7. Job State Machine
8. Database Schema
9. Relationships
10. Indexing Strategy
11. Query Patterns
12. Transactions & Concurrency
13. Performance Optimization
14. Partitioning Strategy
15. Backup & Recovery
16. Future Evolution
17. Chapter Summary

---

# 11.1 Introduction

The **Timer Store** is the heart of the scheduler.

Every scheduled job eventually passes through PostgreSQL before being executed.

Unlike RabbitMQ, which temporarily holds executable messages, PostgreSQL serves as the **source of truth** for scheduling data.

The Timer Store is responsible for:

- Persisting scheduled jobs
- Managing recurring schedules
- Tracking job states
- Supporting retries
- Coordinating scanners
- Providing recovery after failures

---

# 11.2 Why PostgreSQL?

The scheduler requires:

- ACID transactions
- Strong consistency
- Reliable persistence
- Rich indexing
- Efficient range queries
- Mature tooling

PostgreSQL satisfies all of these requirements.

Unlike Redis or RabbitMQ, PostgreSQL guarantees that scheduled jobs survive:

- Process crashes
- Container restarts
- Machine failures

---

# 11.3 Timer Store Responsibilities

The Timer Store owns scheduling data only.

It is **not** responsible for executing jobs.

Responsibilities include:

- Store one-time jobs
- Store recurring schedules
- Update execution status
- Store retry information
- Store timestamps
- Support scanner queries
- Recover unfinished jobs

Execution remains the responsibility of Worker Services.

---

# 11.4 Data Ownership

Only the **Timer Service** accesses PostgreSQL directly.

```text
               PostgreSQL

                     ▲

                     │

             Timer Service

        ┌────────────┼────────────┐

        │            │            │

      API        Scanner      Worker

           (gRPC only)
```

Other services communicate with the Timer Service using gRPC.

This prevents tight coupling between services and the database.

---

# 11.5 Database Architecture

```text
                    PostgreSQL

        ┌─────────────────────────────┐

        │           jobs              │

        │         schedules           │

        │       retry_history         │

        │      execution_history      │

        └─────────────────────────────┘
```

Each table has a clearly defined responsibility.

---

# 11.6 Core Tables

| Table                        | Purpose                          |
| ---------------------------- | -------------------------------- |
| jobs                         | One-time scheduled jobs          |
| schedules                    | Cron & recurring schedules       |
| retry_history                | Retry attempts                   |
| execution_history            | Execution log                    |
| idempotency_keys             | API idempotency                  |
| scanner*leases *(optional)\_ | Local development lease metadata |

In production, lease ownership will eventually move to Redis/etcd rather than PostgreSQL.

---

# 11.7 Job State Machine

Every job moves through a finite set of states.

```text
            CREATED

               │

               ▼

            WAITING

               │

               ▼

            DISPATCHED

               │

               ▼

            RUNNING

          ┌────┴─────┐

          ▼          ▼

     COMPLETED    FAILED

                     │

                     ▼

                 RETRYING

                     │

                     ▼

                 WAITING
```

Alternative terminal state:

```text
WAITING

↓

CANCELLED
```

State transitions are controlled exclusively by the Timer Service and Worker Service.

---

# 11.8 Database Schema

## jobs

| Column      | Type      | Description              |
| ----------- | --------- | ------------------------ |
| id          | UUID      | Primary key              |
| tenant_id   | UUID      | Multi-tenant support     |
| handler     | VARCHAR   | Worker handler           |
| payload     | JSONB     | Job payload              |
| status      | VARCHAR   | Current state            |
| priority    | SMALLINT  | Execution priority       |
| execute_at  | TIMESTAMP | Scheduled execution time |
| retry_count | INTEGER   | Current retries          |
| max_retries | INTEGER   | Retry limit              |
| created_at  | TIMESTAMP | Creation timestamp       |
| updated_at  | TIMESTAMP | Last modification        |

---

## schedules

| Column          | Type      |
| --------------- | --------- |
| id              | UUID      |
| cron_expression | VARCHAR   |
| timezone        | VARCHAR   |
| next_execution  | TIMESTAMP |
| enabled         | BOOLEAN   |
| handler         | VARCHAR   |
| payload         | JSONB     |

---

## retry_history

| Column        | Type      |
| ------------- | --------- |
| id            | UUID      |
| job_id        | UUID      |
| attempt       | INTEGER   |
| error_message | TEXT      |
| retry_at      | TIMESTAMP |

---

## execution_history

| Column       | Type      |
| ------------ | --------- |
| id           | UUID      |
| job_id       | UUID      |
| started_at   | TIMESTAMP |
| completed_at | TIMESTAMP |
| duration_ms  | INTEGER   |
| status       | VARCHAR   |
| worker_id    | VARCHAR   |

---

# 11.9 Relationships

```text
             schedules

                 │

                 │

             generates

                 │

                 ▼

               jobs

                 │

        ┌────────┴─────────┐

        │                  │

        ▼                  ▼

retry_history     execution_history
```

One schedule may generate many jobs.

One job may have many retry attempts.

One job may have one or more execution records.

---

# 11.10 Indexing Strategy

Efficient scanning depends heavily on indexes.

Primary indexes:

```sql
PRIMARY KEY (id)
```

---

Scanner index:

```sql
(status, execute_at)
```

Allows efficient queries such as:

```sql
WHERE status = 'WAITING'
AND execute_at <= NOW()
```

---

Tenant index:

```sql
tenant_id
```

Supports tenant isolation.

---

Schedule index:

```sql
next_execution
```

Allows the Cron Service to efficiently locate schedules that are due.

---

# 11.11 Query Patterns

The scheduler performs predictable query patterns.

---

## Insert Job

```sql
INSERT INTO jobs (...)
```

---

## Update Status

```sql
UPDATE jobs
SET status='RUNNING'
```

---

## Scanner Query

```sql
SELECT *

FROM jobs

WHERE status='WAITING'

AND execute_at <= NOW()

ORDER BY execute_at

LIMIT 100
```

---

## Cancel Job

```sql
UPDATE jobs

SET status='CANCELLED'
```

---

## Retry Query

```sql
UPDATE jobs

SET retry_count = retry_count + 1
```

---

# 11.12 Transactions & Concurrency

Critical operations execute within database transactions.

Example:

```text
Begin Transaction

↓

Insert Job

↓

Commit
```

If any step fails:

```text
Rollback
```

No partial data remains.

---

## Concurrent Updates

Multiple workers may attempt to modify the same job.

To prevent race conditions:

```sql
SELECT ...

FOR UPDATE
```

or

Optimistic locking using a version column.

---

# 11.13 Performance Optimization

Several techniques improve performance.

---

## JSONB

Payloads are stored using JSONB.

Advantages:

- Flexible schema
- Indexed when necessary
- Efficient storage

---

## Batch Updates

Instead of updating jobs individually:

```text
100

UPDATE statements
```

Use:

```text
1

Batch UPDATE
```

---

## Connection Pooling

Each service uses a PostgreSQL connection pool.

Benefits:

- Lower latency
- Better resource utilization
- Fewer TCP connections

---

## Prepared Statements

Frequently executed queries should use prepared statements to reduce parsing overhead.

---

# 11.14 Partitioning Strategy

Initially:

Single table.

As the number of jobs grows:

```text
jobs

├── 2027_01

├── 2027_02

├── 2027_03
```

Monthly partitions reduce:

- index size
- scan time
- maintenance cost

Completed jobs can eventually be archived into historical partitions.

---

# 11.15 Backup & Recovery

Backups are critical because PostgreSQL is the source of truth.

Recovery plan:

```text
Nightly Backup

↓

Object Storage (MinIO)

↓

Restore

↓

Resume Scheduling
```

Point-in-time recovery (PITR) can be introduced in production environments for minimal data loss.

---

# 11.16 Failure Scenarios

## PostgreSQL Crash

```text
Timer Service

↓

Database Unavailable

↓

Reject New Jobs

↓

Existing Jobs Preserved
```

---

## Worker Crash

```text
Job

↓

Still Stored

↓

Scanner Republishes

↓

Execution Continues
```

---

## Scanner Crash

```text
Jobs

↓

Remain WAITING

↓

New Scanner Takes Lease

↓

Promotion Resumes
```

Persistent storage ensures that scheduled work is not lost even if multiple services fail.

---

# 11.17 Future Evolution

### Phase 1

```text
Single PostgreSQL Instance
```

↓

### Phase 2

```text
Read Replicas
```

↓

### Phase 3

```text
Connection Pooling

Partitioning
```

↓

### Phase 4

```text
Logical Replication
```

↓

### Phase 5

```text
Cassandra Timer Store
```

When job volume reaches hundreds of millions or billions of scheduled records, Cassandra becomes a more appropriate Timer Store due to its horizontal scalability and write throughput. The application architecture remains unchanged because only the Timer Service owns the persistence layer.

---

# 11.18 Database Design Principles

The Timer Store follows these principles:

- PostgreSQL is the single source of truth.
- Only the Timer Service accesses the database directly.
- Store immutable job payloads.
- Use transactions for state changes.
- Index all scanner query paths.
- Never perform full-table scans.
- Archive historical data instead of deleting immediately.
- Separate scheduling data from execution history.
- Keep business logic outside SQL whenever possible.

---

# Chapter Summary

This chapter designed the PostgreSQL-based Timer Store for the Distributed Task Scheduler Platform. We defined the database's responsibilities, ownership boundaries, schema, relationships, state machine, indexing strategy, query patterns, transaction management, concurrency control, partitioning, backup strategy, and future evolution. PostgreSQL serves as the durable source of truth for scheduling information while allowing the Scanner and Worker services to operate efficiently through well-defined state transitions and optimized queries.

---

# Next Chapter

**Chapter 12 — Redis Design & Distributed Coordination**

The next chapter focuses on Redis as the platform's coordination layer. It will cover distributed locks, leases, leader election, heartbeats, rate limiting, caching, idempotency storage, failure detection, lease expiration, Redis data structures, and the migration path from Redis-based coordination to etcd for production-grade consensus.

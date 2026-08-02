**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 4

**Filename:** `V2-C04-Jobs-Table-Design.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why the Jobs Table Exists
3. Responsibilities
4. Design Goals
5. Job Lifecycle
6. Table Structure
7. Column-by-Column Design
8. PostgreSQL Data Types
9. Constraints
10. Index Strategy
11. State Machine
12. Query Patterns
13. Partitioning Strategy
14. Transactions & Concurrency
15. Growth Estimation
16. Future Evolution
17. Best Practices
18. Complete SQL
19. Chapter Summary

---

# 4.1 Introduction

The **`scheduler.jobs`** table is the single most important table in the entire platform.

Every feature eventually interacts with this table.

Examples include:

- One-time jobs
- Delayed jobs
- Retry jobs
- Recurring job instances
- Scheduled notifications
- External webhook executions
- Payment reminders
- Background processing

Every job begins its lifecycle here.

Even after a job is executed, its metadata remains stored here until archival.

This table is the **source of truth** for scheduling.

---

# 4.2 Why the Jobs Table Exists

The scheduler's responsibility is to answer one question:

> **What work needs to be executed, and when?**

The jobs table stores exactly that information.

Instead of RabbitMQ holding future work, PostgreSQL stores it permanently.

RabbitMQ only stores work that is **currently being executed**.

Example:

````text
Create Job

↓

PostgreSQL

↓

READY

↓

Scanner

↓

Dispatcher (Exchange Routing)

↓

RabbitMQ Specialized Queue

↓

Worker Execution

↓

Completed

---

# 4.3 Responsibilities

The jobs table stores:

- Job metadata
- Target `worker_type` and RabbitMQ `routing_key`
- Scheduled execution time (`execute_at`)
- Current status (`READY`, `DISPATCHED`, `RUNNING`, `SUCCEEDED`, `FAILED`)
- Priority level
- Attempt counter
- Tenant information (`tenant_id`)
- Payload data

It deliberately does **not** store:

- Granular execution attempt logs (stored in `executions` table)
- Audit history (stored in `audit_events` table)
- Notification history
- Worker metrics

Those belong to dedicated tables.

---

# 4.4 Design Goals

The table is designed to support:

- Millions of rows
- High write throughput
- Low-latency lookups
- Efficient scheduling
- Fast retry updates
- Horizontal scanners
- Multi-tenancy
- Future partitioning

The schema prioritizes write efficiency because new jobs and state transitions occur continuously.

---

# 4.5 Job Lifecycle

A typical 3-Plane lifecycle:

```text
Schedules Table (Intent)
    │
    ▼
INSERT (jobs table: status = READY)
    │
    ▼
DISPATCHED (Dispatcher attaches routing key & publishes to exchange)
    │
    ▼
RUNNING (Specialized worker picks up & starts execution)
    │
    ▼
SUCCEEDED (or FAILED -> Retries revert to READY)
````

Failure & Retry path:

```text
RUNNING
    │
    ▼
FAILED (Execution record logged in Executions table)
    │
    ▼
READY (Retry policy recalculates execute_at & increments attempt)
    │
    ▼
DISPATCHED
    │
    ▼
RUNNING
    │
    ▼
SUCCEEDED (or DLQ if max attempts reached)
```

Every transition is explicit.

---

# 4.6 High-Level Table Layout

```text
scheduler.jobs

├── Identity
├── Scheduling
├── State
├── Retry
├── Payload
├── Ownership
├── Multi-tenancy
├── Metadata
└── Audit Fields
```

Grouping related columns makes the schema easier to understand.

---

# 4.7 Complete Column Design

## Identity

| Column          | Type         | Description                           |
| --------------- | ------------ | ------------------------------------- |
| id              | UUID         | Primary key                           |
| external_id     | VARCHAR(255) | Client supplied identifier (optional) |
| correlation_id  | UUID         | Distributed trace correlation         |
| idempotency_key | VARCHAR(255) | Duplicate protection                  |

---

## Multi-Tenant

| Column     | Type |
| ---------- | ---- |
| tenant_id  | UUID |
| created_by | UUID |

---

## Scheduling

| Column       | Type        |
| ------------ | ----------- |
| execute_at   | TIMESTAMPTZ |
| scheduled_at | TIMESTAMPTZ |
| bucket_id    | BIGINT      |
| priority     | SMALLINT    |

---

## State

| Column        | Type        |
| ------------- | ----------- |
| status        | job_status  |
| version       | INTEGER     |
| dispatched_at | TIMESTAMPTZ |
| started_at    | TIMESTAMPTZ |
| completed_at  | TIMESTAMPTZ |

---

## Retry

| Column        | Type        |
| ------------- | ----------- |
| retry_count   | INTEGER     |
| max_retries   | INTEGER     |
| next_retry_at | TIMESTAMPTZ |
| last_retry_at | TIMESTAMPTZ |

---

## Payload

| Column   | Type         |
| -------- | ------------ |
| handler  | VARCHAR(255) |
| payload  | JSONB        |
| metadata | JSONB        |

---

## Ownership

| Column        | Type        |
| ------------- | ----------- |
| scanner_id    | UUID        |
| dispatcher_id | UUID        |
| worker_id     | UUID        |
| lease_until   | TIMESTAMPTZ |

---

## Audit

| Column     | Type        |
| ---------- | ----------- |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |
| deleted_at | TIMESTAMPTZ |

---

# 4.8 Why Each Column Exists

## execute_at

The scheduler continuously searches for:

```sql
WHERE execute_at <= NOW()
```

Without this field the scheduler cannot determine when a job should run.

---

## bucket_id

Instead of scanning every job:

```text
20 Million Jobs
```

Scanner searches:

```text
Bucket 492
```

This enables horizontal scaling.

---

## version

Used for optimistic locking.

Example:

```text
Version = 5

↓

Worker updates

↓

Version = 6
```

If another process already updated the row:

```text
Expected Version 5

Actual Version 6

↓

Conflict
```

---

## payload

Stores business data.

Example:

```json
{
  "email": "user@example.com",
  "subject": "Invoice",
  "invoiceId": "INV-2048"
}
```

Using JSONB keeps the scheduler generic; it does not need to know the structure of every job type.

---

# 4.9 PostgreSQL Data Types

| Type        | Reason                   |
| ----------- | ------------------------ |
| UUID        | Distributed identifiers  |
| TIMESTAMPTZ | Timezone-safe timestamps |
| SMALLINT    | Priority                 |
| INTEGER     | Retry counters           |
| JSONB       | Payload                  |
| VARCHAR     | Handler names            |
| BOOLEAN     | Flags                    |

Avoid generic TEXT unless values are truly unbounded.

---

# 4.10 Constraints

Primary key:

```sql
PRIMARY KEY (id)
```

Unique:

```sql
UNIQUE(idempotency_key)
```

Check:

```sql
retry_count >= 0
```

Check:

```sql
priority BETWEEN 1 AND 10
```

Check:

```sql
max_retries >= retry_count
```

Foreign keys:

```text
tenant_id

↓

identity.tenants
```

```text
created_by

↓

identity.users
```

---

# 4.11 Index Strategy

Most important index:

```sql
(status, execute_at)
```

Used by Scanner.

---

Retry:

```sql
(status, next_retry_at)
```

---

Tenant:

```sql
(tenant_id)
```

---

Worker:

```sql
(worker_id)
```

---

Correlation:

```sql
(correlation_id)
```

---

Idempotency:

```sql
(idempotency_key)
```

---

JSONB:

```sql
GIN(payload)
```

Used only if querying payload fields becomes necessary.

---

# 4.12 State Machine

Allowed transitions:

```text
WAITING

↓

DISPATCHED

↓

RUNNING

↓

COMPLETED
```

Failure:

```text
RUNNING

↓

FAILED
```

Retry:

```text
FAILED

↓

WAITING
```

Dead letter:

```text
FAILED

↓

DLQ
```

Invalid transitions should be rejected by application logic.

---

# 4.13 Query Patterns

Most common query:

```sql
SELECT *
FROM scheduler.jobs
WHERE status='WAITING'
AND execute_at<=NOW()
ORDER BY execute_at
LIMIT 500;
```

---

Worker lookup:

```sql
SELECT *
FROM scheduler.jobs
WHERE id=$1;
```

---

Tenant jobs:

```sql
SELECT *
FROM scheduler.jobs
WHERE tenant_id=$1;
```

---

Retry lookup:

```sql
SELECT *
FROM scheduler.jobs
WHERE next_retry_at<=NOW();
```

These queries drive index design.

---

# 4.14 Partitioning Strategy

Initially:

```text
jobs
```

Later:

```text
jobs_2026_01

jobs_2026_02

jobs_2026_03
```

Range partitioning on `created_at` or `execute_at` keeps indexes small and simplifies archival.

---

# 4.15 Transactions & Concurrency

Typical promotion flow:

```text
Scanner

↓

SELECT FOR UPDATE SKIP LOCKED

↓

Update Status

↓

Commit
```

`FOR UPDATE SKIP LOCKED` allows multiple Scanner instances to work concurrently without blocking each other.

Optimistic locking via the `version` column protects updates made by Workers and API requests.

---

# 4.16 Growth Estimation

Assume:

- 2 million jobs/day
- 60 million jobs/month
- 720 million jobs/year

Without partitioning, indexes become very large.

The schema is therefore designed to support archival and partitioning from the beginning.

---

# 4.17 Future Evolution

```text
Basic Jobs Table

↓

Additional Metadata

↓

Partitioning

↓

Compression

↓

Archive Storage

↓

Cross-Region Replication
```

The logical schema remains stable while storage evolves.

---

# 4.18 Best Practices

- Keep the row relatively narrow.
- Avoid unnecessary joins in scheduling queries.
- Never store execution logs here.
- Index only frequently queried columns.
- Use JSONB only for flexible payloads.
- Update state through transactions.
- Keep payload immutable after creation.
- Archive completed jobs regularly.
- Never perform full-table scans.
- Design queries before adding indexes.

---

# 4.19 Initial SQL Definition (Simplified)

```sql
CREATE TABLE scheduler.jobs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    created_by UUID,
    external_id VARCHAR(255),
    correlation_id UUID,
    idempotency_key VARCHAR(255),

    handler VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB,

    status job_status NOT NULL,
    priority SMALLINT DEFAULT 5,

    execute_at TIMESTAMPTZ NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,

    bucket_id BIGINT,

    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    last_retry_at TIMESTAMPTZ,

    scanner_id UUID,
    dispatcher_id UUID,
    worker_id UUID,
    lease_until TIMESTAMPTZ,

    version INTEGER DEFAULT 1,

    dispatched_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

> **Note:** This is the **initial logical schema**. In later chapters (partitioning, indexing, migrations, PostgreSQL optimization), we will refine it further by adding enums, generated columns, partial indexes, table partitioning, triggers, and storage optimizations.

---

# Chapter Summary

This chapter designed the core `scheduler.jobs` table, which serves as the persistent source of truth for every schedulable task in the platform. We defined its responsibilities, lifecycle, column groups, data types, constraints, indexes, concurrency strategy, query patterns, partitioning approach, and an initial SQL definition. Every scheduling operation—from job creation to dispatch, execution, retries, and archival—will build upon this table.

---

# Next Chapter

**Filename:** `V2-C05-Recurring-Schedules-Table.md`

**Chapter 5 — Recurring Schedules Table Design**

The next chapter will design the `scheduler.recurring_schedules` table in detail, covering cron expressions, time zones, recurrence windows, pause/resume behavior, catch-up policies, Cron Expander interaction, and how recurring schedules generate concrete job instances without creating an infinite number of future jobs.

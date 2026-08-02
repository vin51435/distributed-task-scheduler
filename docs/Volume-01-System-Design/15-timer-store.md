# Chapter 15 — Timer Store Architecture & Scheduling Engine

**Document:** Distributed Task Scheduler Platform
**Chapter:** 15
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Design Goals
3. Timer Store Responsibilities
4. Scheduling Architecture
5. Job Lifecycle
6. Timer Store Data Model
7. Scheduling Algorithms
8. Bucketization Strategy
9. Scanner Query Optimization
10. Job Promotion Process
11. State Management
12. Concurrency Control
13. Failure Recovery
14. Performance Optimization
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 15.1 Introduction

The **Timer Store** is the core scheduling engine of the Distributed Task Scheduler Platform.

While PostgreSQL provides durable storage, the Timer Store defines **how jobs move through the scheduling lifecycle** until they are ready for execution.

Its responsibilities include:

- Persisting scheduled jobs
- Determining when jobs become executable
- Promoting ready jobs
- Preventing duplicate dispatch
- Recovering from failures
- Coordinating scanners

The Timer Store belongs entirely to the **Timing Plane**.

---

# 15.2 Design Goals

The Timer Store is designed to achieve:

- Accurate scheduling
- Millisecond-level execution precision (best effort)
- High throughput
- Horizontal scalability
- Fault tolerance
- Predictable query performance
- Efficient recovery
- Idempotent dispatch

---

# 15.3 Timer Store Responsibilities

The Timer Store is responsible for:

- Creating jobs
- Updating schedules
- Tracking execution state
- Selecting executable jobs
- Preventing duplicate dispatch
- Supporting retries
- Recovering unfinished work

The Timer Store is **not** responsible for:

- Executing jobs
- Business logic
- Notifications
- Audit logging

These responsibilities belong to downstream services.

---

# 15.4 Scheduling Architecture

```text
               Client

                  │

              REST API

                  │

             Timer Service

                  │

            PostgreSQL Store

                  │

             Scanner Service

                  │

              RabbitMQ Queue

                  │

            Worker Service
```

The Timer Store bridges the API and the Execution Plane.

---

# 15.5 Job Lifecycle

A one-time scheduled job progresses through several states.

```text
CREATE REQUEST

      │

      ▼

Persist Job

      │

      ▼

READY

      │

      ▼

Scanner Finds Job

      │

      ▼

Lease Acquired

      │

      ▼

Publish To RabbitMQ

      │

      ▼

DISPATCHED

      │

      ▼

Worker Executes

      │

      ▼

COMPLETED
```

Failure transitions lead to retry or cancellation states instead of completion.

---

# 15.6 Timer Store Data Model

The Timer Store primarily operates on the **jobs** table.

Important attributes include:

| Field       | Purpose                  |
| ----------- | ------------------------ |
| id          | Job identifier           |
| execute_at  | Scheduled execution time |
| status      | Current lifecycle state  |
| priority    | Scheduling priority      |
| retry_count | Retry tracking           |
| tenant_id   | Tenant isolation         |
| handler     | Worker handler           |
| payload     | Execution payload        |

These attributes allow scanners to efficiently locate executable jobs.

---

# 15.7 Scheduling Algorithms

The scheduler supports multiple scheduling strategies.

---

## One-Time Scheduling

The simplest case.

```text
Create Job

↓

READY

↓

Execute At Time T
```

---

## Delayed Scheduling

Example:

```text
Current Time

12:00

↓

Delay

30 Minutes

↓

Execute

12:30
```

The delay is converted into an absolute `execute_at` timestamp during job creation.

---

## Recurring Scheduling

Recurring schedules generate future jobs.

```text
Cron Schedule

↓

Next Execution

↓

Generate Job

↓

READY
```

The original schedule remains unchanged while each occurrence creates a new job.

---

## Retry Scheduling

Failures create delayed retry jobs.

```text
Failure

↓

Backoff

↓

Update execute_at

↓

READY
```

---

# 15.8 Bucketization Strategy

Scanning millions of rows every second is inefficient.

The Timer Store therefore divides time into **logical buckets**.

Example:

```text
09:00

09:01

09:02

09:03

09:04
```

Jobs scheduled within the same time window belong to the same logical bucket.

Scanners process only the buckets that are currently due.

---

## Benefits

- Smaller scans
- Better cache locality
- Easier horizontal scaling
- Predictable latency

---

# 15.9 Scanner Query Optimization

The scanner repeatedly executes a query similar to:

```sql
SELECT *

FROM jobs

WHERE status='READY'

AND execute_at <= NOW()

ORDER BY execute_at

LIMIT 500;
```

Supporting index:

```text
(status, execute_at)
```

This avoids full-table scans and allows efficient range lookups.

---

# 15.10 Job Promotion Process

Promotion is the act of moving a job from durable storage to the execution broker.

```text
READY

↓

Scanner Selects Job

↓

Acquire Lease

↓

Publish RabbitMQ Message

↓

Update Status

↓

DISPATCHED
```

Only after successful publication does the Timer Store update the job state.

This ordering prevents jobs from being marked as dispatched before they are safely handed to RabbitMQ.

---

# 15.11 State Management

The Timer Store enforces valid state transitions.

```text
READY

↓

DISPATCHED

↓

RUNNING

↓

COMPLETED
```

Failure path:

```text
RUNNING

↓

FAILED

↓

RETRYING

↓

READY
```

Cancellation path:

```text
READY

↓

CANCELLED
```

Invalid transitions are rejected.

Example:

```text
COMPLETED

↓

READY

❌ Invalid
```

---

# 15.12 Concurrency Control

Multiple scanners may discover the same job simultaneously.

To prevent duplicate dispatch:

```text
Scanner A

↓

Acquire Lease

↓

Success
```

```text
Scanner B

↓

Acquire Lease

↓

Rejected
```

Lease ownership ensures only one scanner publishes a particular job.

Database transactions protect updates to job state.

---

# 15.13 Failure Recovery

## Scanner Crash

```text
Scanner

↓

Lease Lost

↓

Another Scanner

↓

Reprocess Job
```

---

## RabbitMQ Failure

```text
Publish

↓

Failed

↓

Job Remains READY
```

The scanner retries later.

---

## PostgreSQL Restart

```text
Database Restored

↓

Jobs Still Exist

↓

Scanner Continues
```

Because PostgreSQL is the source of truth, scheduling resumes automatically after recovery.

---

# 15.14 Performance Optimization

Several techniques improve throughput.

---

## Batch Promotion

Instead of publishing one job at a time:

```text
500 Individual Queries
```

Publish jobs in batches.

---

## Sequential Scans

Scanner queries should follow index order.

Avoid random access patterns.

---

## Connection Pooling

Reuse PostgreSQL connections instead of opening a new connection for every query.

---

## Lightweight Updates

Only update columns that change.

Example:

```text
status

updated_at
```

instead of rewriting the entire row.

---

## Asynchronous Dispatch

Publishing to RabbitMQ should not block future scanner iterations longer than necessary.

---

# 15.15 Future Evolution

### Phase 1

```text
Single Scanner
```

↓

### Phase 2

```text
Multiple Scanners

+

Bucket Ownership
```

↓

### Phase 3

```text
Dynamic Bucket Assignment
```

↓

### Phase 4

```text
Consistent Hashing
```

↓

### Phase 5

```text
Cassandra-Based Timer Store
```

As scheduling volume grows, the Timer Store architecture evolves while preserving the same scheduling semantics.

---

# 15.16 Timer Store Best Practices

The scheduler follows these principles:

- PostgreSQL is the source of truth.
- Never execute jobs directly from the database.
- Promote jobs only after acquiring ownership.
- Keep scanner queries index-friendly.
- Batch operations whenever possible.
- Validate every state transition.
- Recover unfinished jobs automatically.
- Avoid full-table scans.
- Separate scheduling from execution.
- Design promotion to be idempotent.

---

# 15.17 Timer Store Responsibilities Summary

| Component           | Responsibility             |
| ------------------- | -------------------------- |
| API Service         | Accept scheduling requests |
| Timer Service       | Persist and manage jobs    |
| PostgreSQL          | Durable storage            |
| Scanner Service     | Discover due jobs          |
| Coordinator Service | Assign scanner ownership   |
| RabbitMQ            | Deliver executable jobs    |
| Worker Service      | Execute jobs               |

---

# Chapter Summary

This chapter designed the Timer Store as the core scheduling engine of the Distributed Task Scheduler Platform. We explored its responsibilities, scheduling architecture, job lifecycle, bucketization strategy, scanner query optimization, job promotion process, state management, concurrency control, failure recovery, and performance optimizations. The Timer Store ensures that scheduled jobs are durably persisted, promoted exactly once into the execution pipeline through idempotent coordination, and efficiently processed at scale while remaining independent from the execution layer.

---

# Next Chapter

**Chapter 16 — Scanner Service Design & Job Promotion Engine**

The next chapter focuses on the Scanner Service, which continuously monitors the Timer Store for due jobs, acquires bucket leases through the Coordinator Service, promotes executable jobs to RabbitMQ, balances workload across multiple scanner instances, handles failures, and ensures that every scheduled job is dispatched safely and efficiently without duplicate execution.

# Chapter 16 — Scanner Service Design & Job Promotion Engine

**Document:** Distributed Task Scheduler Platform
**Chapter:** 16
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Scanner Responsibilities
3. Design Goals
4. Scanner Architecture
5. Scanner Lifecycle
6. Bucket Ownership
7. Scanner Algorithm
8. Job Promotion Pipeline
9. Lease Management
10. Batch Processing
11. Failure Recovery
12. Performance Optimization
13. Horizontal Scaling
14. Future Evolution
15. Best Practices
16. Chapter Summary

---

# 16.1 Introduction

The **Scanner Service** is responsible for continuously monitoring the Timer Store and promoting jobs that are ready for execution.

Unlike the Timer Service, which accepts and stores scheduling requests, the Scanner performs no scheduling decisions. Instead, it periodically checks whether scheduled jobs have reached their execution time and safely transfers them into the Execution Plane.

The Scanner acts as the bridge between:

- PostgreSQL (Timing Plane)
- RabbitMQ (Execution Plane)

Without the Scanner, scheduled jobs would remain permanently stored in the Timer Store and never execute.

---

# 16.2 Scanner Responsibilities

The Scanner Service is responsible for:

- Polling the Timer Store
- Acquiring ownership of assigned buckets
- Discovering due jobs
- Promoting jobs to RabbitMQ
- Updating job state
- Recovering interrupted promotions
- Renewing bucket leases

The Scanner is **not** responsible for:

- Creating jobs
- Executing jobs
- Running business logic
- Managing recurring schedules

---

# 16.3 Design Goals

The Scanner is designed to achieve:

- High throughput
- Low scheduling latency
- Exactly-once promotion semantics (through idempotency)
- Horizontal scalability
- Fault tolerance
- Efficient database usage
- Automatic recovery

---

# 16.4 Scanner Architecture

```text
                 Timer Service

                      │

                PostgreSQL

                      │

              Scanner Service

          ┌───────────┴───────────┐

          │                       │

     Coordinator             RabbitMQ

          │                       │

      Lease Owner         Execution Queue
```

The Scanner communicates with:

- PostgreSQL
- Coordinator Service
- RabbitMQ

---

# 16.5 Scanner Lifecycle

Every scanner continuously repeats the same workflow.

```text
Start

↓

Register

↓

Acquire Bucket Lease

↓

Scan Jobs

↓

Promote Jobs

↓

Renew Lease

↓

Repeat
```

This loop continues for the lifetime of the service.

---

# 16.6 Bucket Ownership

Time buckets are distributed across multiple scanners.

Example:

```text
Bucket 1 → Scanner A

Bucket 2 → Scanner B

Bucket 3 → Scanner C

Bucket 4 → Scanner A
```

A scanner processes only the buckets it owns.

Ownership is coordinated by the Coordinator Service.

---

## Why Ownership?

Without ownership:

```text
Scanner A

↓

Same Job

↑

Scanner B
```

Both scanners could publish the same job.

Bucket leases eliminate duplicate promotion.

---

# 16.7 Scanner Algorithm

Each iteration performs the following steps.

```text
Acquire Lease

↓

Query Due Jobs

↓

Select Batch

↓

Publish Messages

↓

Update Status

↓

Commit

↓

Repeat
```

Pseudo workflow:

```text
while (running)

↓

Acquire Lease

↓

SELECT waiting jobs

↓

Publish Batch

↓

Mark DISPATCHED

↓

Renew Lease
```

---

# 16.8 Job Promotion Pipeline

Promotion consists of several ordered operations.

```text
READY Job

↓

Scanner Finds Job

↓

Acquire Ownership

↓

Publish RabbitMQ Message

↓

Publisher Confirm

↓

Update PostgreSQL

↓

DISPATCHED
```

The order is important.

The database is updated only after RabbitMQ confirms successful publication.

---

# 16.9 Lease Management

Every owned bucket has an expiration.

```text
Acquire Lease

↓

30 Seconds

↓

Renew

↓

30 Seconds

↓

Renew Again
```

If renewal stops:

```text
Scanner Crash

↓

Lease Expires

↓

Bucket Released

↓

Another Scanner Claims Bucket
```

No manual intervention is required.

---

# 16.10 Batch Processing

Publishing one job at a time is inefficient.

Instead:

```text
500 Jobs

↓

Single Database Query

↓

500 RabbitMQ Messages

↓

Single Batch Update
```

Benefits:

- Fewer queries
- Better throughput
- Lower latency
- Reduced network overhead

Batch size should be configurable.

Example:

```text
promotionBatchSize = 500
```

---

# 16.11 Scanner Timing

The Scanner executes periodically.

Example:

```text
Current Time

↓

Sleep

100 ms

↓

Scan

↓

Sleep

100 ms
```

Short polling intervals reduce scheduling latency.

The interval should balance:

- CPU utilization
- Database load
- Execution precision

---

# 16.12 Failure Recovery

## Scanner Crash

```text
Scanner

↓

Stops

↓

Lease Expires

↓

Another Scanner

↓

Resumes Bucket
```

---

## Database Failure

```text
Query

↓

Failed

↓

Retry

↓

Continue
```

Jobs remain safely stored in PostgreSQL.

---

## RabbitMQ Failure

```text
Publish

↓

Failed

↓

Status NOT Updated

↓

Retry Later
```

Jobs remain in the `READY` state until promotion succeeds.

---

## Coordinator Failure

```text
Cannot Renew Lease

↓

Scanner Stops Promotion

↓

Wait

↓

Reconnect
```

Stopping promotion prevents duplicate ownership during coordination failures.

---

# 16.13 Performance Optimization

## Indexed Queries

Only query indexed columns.

```sql
WHERE status='READY'

AND execute_at <= NOW()
```

---

## Batch Reads

Avoid:

```text
SELECT

1 Job
```

Instead:

```text
SELECT

500 Jobs
```

---

## Batch Updates

Update multiple rows together whenever possible.

---

## Connection Pooling

Reuse database connections.

---

## Parallel Buckets

A scanner may process multiple owned buckets concurrently if system resources permit.

---

# 16.14 Horizontal Scaling

Additional scanners increase capacity.

```text
                 PostgreSQL

                      │

       ┌──────────────┼──────────────┐

       │              │              │

 Scanner A      Scanner B      Scanner C

       │              │              │

       └──────────────┼──────────────┘

                 RabbitMQ
```

The Coordinator assigns bucket ownership dynamically.

No application changes are required when new scanner instances are added.

---

# 16.15 Failure Scenarios

## Slow Scanner

```text
Scanner

↓

Cannot Renew Lease

↓

Lease Expires

↓

Ownership Lost
```

The scanner immediately stops processing that bucket.

---

## Duplicate Publish Attempt

```text
Scanner A

↓

Already Promoted

↓

Ignore
```

Idempotent promotion prevents duplicate execution.

---

## Long Database Query

```text
Query

↓

Timeout

↓

Retry

↓

Alert
```

Monitoring detects scanners that consistently fall behind.

---

# 16.16 Future Evolution

### Phase 1

```text
Single Scanner
```

↓

### Phase 2

```text
Multiple Scanners

+

Bucket Leases
```

↓

### Phase 3

```text
Dynamic Rebalancing
```

↓

### Phase 4

```text
Adaptive Scan Frequency
```

↓

### Phase 5

```text
Consistent Hashing

+

Automatic Bucket Migration
```

As the platform scales, scanners can automatically rebalance ownership based on workload without changing the scheduling model.

---

# 16.17 Scanner Best Practices

The Scanner follows these principles:

- Never promote without owning the bucket.
- Update job status only after publisher confirmation.
- Batch database operations.
- Keep polling intervals configurable.
- Avoid full-table scans.
- Process buckets independently.
- Release leases immediately on shutdown.
- Handle duplicate promotion safely.
- Monitor scanner lag continuously.
- Keep scanning logic stateless.

---

# 16.18 Scanner Metrics

| Metric                 | Purpose                              |
| ---------------------- | ------------------------------------ |
| Scan Duration          | Time per scan cycle                  |
| Jobs Promoted          | Throughput                           |
| Promotion Latency      | Scheduling accuracy                  |
| Bucket Ownership       | Scanner distribution                 |
| Lease Renewal Failures | Coordination health                  |
| Database Query Time    | Timer Store performance              |
| Publish Success Rate   | RabbitMQ reliability                 |
| Scanner Lag            | Delay between due time and promotion |

These metrics help operators determine whether the Timing Plane is keeping up with scheduled workload.

---

# Chapter Summary

This chapter designed the Scanner Service as the job promotion engine of the Distributed Task Scheduler Platform. We examined its responsibilities, lifecycle, bucket ownership model, promotion pipeline, lease management, batch processing, failure recovery, performance optimizations, horizontal scaling strategy, and operational metrics. The Scanner safely transfers jobs from the Timer Store into RabbitMQ while ensuring efficient, fault-tolerant, and idempotent promotion across multiple distributed scanner instances.

---

# Next Chapter

**Chapter 17 — Cron Service & Recurring Schedule Engine**

The next chapter focuses on the Cron Service, which manages recurring schedules. It will cover cron expression parsing, timezone handling, daylight saving time considerations, next execution calculation, recurring job generation, schedule persistence, distributed ownership, failure recovery, and scalable processing of millions of recurring schedules.

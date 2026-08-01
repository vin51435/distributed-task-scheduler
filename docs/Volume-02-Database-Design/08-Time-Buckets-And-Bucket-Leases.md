# Filename

**`V2-C08-Time-Buckets-And-Bucket-Leases.md`**

---

# Volume 2 — Database Design

# Chapter 8 — Time Buckets & Bucket Leases Design

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 8

**Filename:** `V2-C08-Time-Buckets-And-Bucket-Leases.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Time Buckets?
3. Scheduling Problem
4. Time Bucket Architecture
5. Bucket Granularity
6. Bucket Lifecycle
7. Bucket Metadata Table
8. Bucket Lease Table
9. Scanner Ownership
10. Lease Expiration
11. Redis Integration
12. PostgreSQL Integration
13. Query Patterns
14. Constraints & Indexes
15. Complete SQL
16. Future Evolution
17. Best Practices
18. Chapter Summary

---

# 8.1 Introduction

The scheduler is designed to support **millions of future jobs**.

A naive implementation scans the `jobs` table every second:

```sql
SELECT *
FROM scheduler.jobs
WHERE execute_at <= NOW()
AND status = 'WAITING';
```

This works for:

- 100 jobs
- 1,000 jobs
- 10,000 jobs

Eventually it fails.

Imagine:

```
250 Million Jobs
```

Scanning the entire table every second becomes extremely expensive.

Instead, the scheduler introduces **Time Buckets**.

Time Buckets allow Scanners to inspect only a very small subset of jobs that are due for execution.

---

# 8.2 The Problem

Suppose we have:

```
Today

08:00

↓

10 Jobs

09:00

↓

25 Jobs

10:00

↓

18 Jobs

...

↓

250 Million Future Jobs
```

Only a few jobs are due now.

Yet without buckets, PostgreSQL must repeatedly search a massive table.

This wastes:

- CPU
- I/O
- Buffer cache
- Index traversal

---

# 8.3 The Solution

Instead of treating the entire timeline as one large space, we divide time into small windows.

Example:

```
08:00

↓

Bucket 480

08:01

↓

Bucket 481

08:02

↓

Bucket 482

08:03

↓

Bucket 483
```

Each job belongs to exactly one bucket.

The Scanner only scans active buckets.

---

# 8.4 Time Bucket Architecture

```
Recurring Job

↓

Jobs Table

↓

bucket_id

↓

Scanner

↓

Lease

↓

Dispatcher
```

The bucket is **metadata**.

The actual job remains inside `scheduler.jobs`.

---

# 8.5 Bucket Granularity

The bucket size determines how many jobs are grouped together.

Examples:

| Bucket Size | Advantages     | Disadvantages            |
| ----------- | -------------- | ------------------------ |
| 1 second    | Precise        | Too many buckets         |
| 10 seconds  | Good precision | Moderate bucket count    |
| 30 seconds  | Balanced       | Slight scheduling delay  |
| 1 minute    | Fewer buckets  | More jobs per bucket     |
| 5 minutes   | Small metadata | Higher promotion latency |

For this scheduler:

**Default bucket size: 1 minute**

Example:

```
08:00:00

↓

08:00:59

↓

Bucket #10241
```

Every job scheduled during that minute belongs to the same bucket.

---

# 8.6 Bucket Calculation

Bucket IDs are deterministic.

Formula:

```
bucket_id =
floor(
    execute_at_epoch /
    bucket_size_seconds
)
```

Example:

```
Execute Time

08:35

↓

Epoch

↓

Divide by 60

↓

Bucket 284521
```

Every service calculates the same bucket independently.

No lookup is required.

---

# 8.7 Bucket Lifecycle

```
Bucket Created

↓

Jobs Added

↓

Scanner Acquires Lease

↓

Jobs Promoted

↓

Bucket Empty

↓

Archived
```

Buckets are lightweight metadata.

They do not store business payloads.

---

# 8.8 Bucket Metadata Table

Table:

```
scheduler.time_buckets
```

Purpose:

Stores metadata about each bucket.

---

## Columns

| Column         | Type          | Description             |
| -------------- | ------------- | ----------------------- |
| bucket_id      | BIGINT        | Bucket identifier       |
| bucket_start   | TIMESTAMPTZ   | Window start            |
| bucket_end     | TIMESTAMPTZ   | Window end              |
| job_count      | INTEGER       | Jobs inside             |
| promoted_count | INTEGER       | Jobs already dispatched |
| status         | bucket_status | Current state           |
| created_at     | TIMESTAMPTZ   | Creation time           |
| updated_at     | TIMESTAMPTZ   | Last update             |

---

## Status Values

```
OPEN

↓

LEASED

↓

PROMOTING

↓

COMPLETED

↓

ARCHIVED
```

---

# 8.9 Bucket Lease Table

Multiple Scanner instances run simultaneously.

Without coordination:

```
Scanner A

↓

Bucket 500
```

At the same time:

```
Scanner B

↓

Bucket 500
```

Both promote identical jobs.

Duplicate execution occurs.

---

Instead:

```
Scanner A

↓

Acquire Lease

↓

Scanner B

↓

Lease Exists

↓

Skip Bucket
```

---

Table:

```
scheduler.bucket_leases
```

---

## Columns

| Column            | Type        |
| ----------------- | ----------- |
| id                | UUID        |
| bucket_id         | BIGINT      |
| scanner_id        | UUID        |
| lease_acquired_at | TIMESTAMPTZ |
| lease_expires_at  | TIMESTAMPTZ |
| heartbeat_at      | TIMESTAMPTZ |
| version           | INTEGER     |

---

# 8.10 Why Separate Bucket Metadata and Bucket Leases?

Two responsibilities exist.

Bucket:

```
Metadata
```

Lease:

```
Ownership
```

Metadata changes infrequently.

Lease changes continuously.

Separating them reduces write contention.

---

# 8.11 Scanner Ownership

Acquiring ownership:

```
Scanner

↓

Find Bucket

↓

Acquire Lease

↓

Promote Jobs
```

Lease duration:

Example:

```
30 Seconds
```

Heartbeat:

```
Scanner

↓

Heartbeat

↓

Lease Extended
```

---

# 8.12 Lease Expiration

Suppose Scanner crashes.

```
Scanner

↓

Lease

↓

Crash
```

Heartbeat stops.

Eventually:

```
Lease Expired

↓

Scanner B

↓

Acquire Lease

↓

Continue Promotion
```

No manual intervention required.

---

# 8.13 Redis Integration

Redis stores active leases.

```
Scanner

↓

Redis

↓

Lease
```

Benefits:

- Fast acquisition
- Fast renewal
- Automatic expiration

Redis keys:

```
bucket:284521

↓

scanner-3
```

TTL:

```
30 Seconds
```

---

# 8.14 PostgreSQL Integration

Redis coordinates ownership.

PostgreSQL stores history.

```
Redis

↓

Current Lease

↓

PostgreSQL

↓

Historical Record
```

If Redis is restarted:

```
Scanner

↓

Rebuild Leases
```

Persistent metadata remains available.

---

# 8.15 Scanner Flow

```
Scanner

↓

Current Time

↓

Calculate Bucket

↓

Acquire Lease

↓

Load Jobs

↓

Promote

↓

Update Metadata

↓

Release Lease
```

---

# 8.16 Query Patterns

Find active bucket:

```sql
SELECT *
FROM scheduler.time_buckets
WHERE bucket_start <= NOW()
AND bucket_end > NOW();
```

Jobs inside bucket:

```sql
SELECT *
FROM scheduler.jobs
WHERE bucket_id = $1
AND status='WAITING';
```

Expired leases:

```sql
SELECT *
FROM scheduler.bucket_leases
WHERE lease_expires_at < NOW();
```

Bucket statistics:

```sql
SELECT bucket_id,
       job_count,
       promoted_count
FROM scheduler.time_buckets;
```

---

# 8.17 Constraints

Bucket:

```sql
PRIMARY KEY(bucket_id)
```

Lease:

```sql
PRIMARY KEY(id)
```

Foreign Key:

```sql
bucket_id
REFERENCES scheduler.time_buckets(bucket_id)
```

Check:

```sql
job_count >= 0
```

Check:

```sql
promoted_count >= 0
```

Check:

```sql
lease_expires_at >
lease_acquired_at
```

---

# 8.18 Index Strategy

Time Buckets:

```
(bucket_start)
```

```
(status)
```

Composite:

```
(status, bucket_start)
```

Bucket Leases:

```
(bucket_id)
```

```
(scanner_id)
```

```
(lease_expires_at)
```

Composite:

```
(bucket_id, scanner_id)
```

---

# 8.19 Initial SQL Definition

## time_buckets

```sql
CREATE TABLE scheduler.time_buckets (

    bucket_id BIGINT PRIMARY KEY,

    bucket_start TIMESTAMPTZ NOT NULL,

    bucket_end TIMESTAMPTZ NOT NULL,

    job_count INTEGER DEFAULT 0,

    promoted_count INTEGER DEFAULT 0,

    status bucket_status NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## bucket_leases

```sql
CREATE TABLE scheduler.bucket_leases (

    id UUID PRIMARY KEY,

    bucket_id BIGINT NOT NULL
        REFERENCES scheduler.time_buckets(bucket_id),

    scanner_id UUID NOT NULL,

    lease_acquired_at TIMESTAMPTZ,

    lease_expires_at TIMESTAMPTZ,

    heartbeat_at TIMESTAMPTZ,

    version INTEGER DEFAULT 1
);
```

---

# 8.20 Why Not Use Only Redis?

Some schedulers keep bucket ownership only in Redis.

Problems:

```
Redis Restart

↓

All Ownership Lost
```

Recovery becomes difficult.

Instead:

Redis:

```
Fast Coordination
```

PostgreSQL:

```
Persistent Metadata
```

Each technology performs the task it is best suited for.

---

# 8.21 Growth Estimation

Assume:

- 1-minute buckets
- 1 year

Total buckets:

```
365

×

24

×

60

=

525,600 Buckets
```

This is tiny compared to:

```
700 Million Jobs
```

The metadata overhead is negligible.

---

# 8.22 Future Evolution

```
Single Scanner

↓

Multiple Scanners

↓

Distributed Leases

↓

Geo-Distributed Buckets

↓

Adaptive Bucket Sizes
```

Future versions may dynamically resize buckets based on workload density.

---

# 8.23 Best Practices

- Never scan the entire jobs table.
- Calculate bucket IDs deterministically.
- Keep buckets lightweight.
- Separate metadata from leases.
- Use Redis for active ownership.
- Store persistent metadata in PostgreSQL.
- Expire leases automatically.
- Heartbeat active leases.
- Promote jobs in batches.
- Monitor bucket lag and lease contention.

---

# Chapter Summary

This chapter designed the **Time Bucket** and **Bucket Lease** persistence model that enables the scheduler to scale from thousands to hundreds of millions of jobs. We introduced deterministic bucket calculation, bucket metadata, lease ownership, Redis-based coordination, PostgreSQL persistence, scanner heartbeats, lease expiration, query patterns, indexing, and SQL schemas. By dividing the timeline into manageable buckets and coordinating ownership through leases, the scheduler avoids expensive full-table scans while allowing multiple Scanner instances to operate safely in parallel.

---

# Next Chapter

**Filename:** `V2-C09-Dispatch-History.md`

**Chapter 9 — Dispatch History & Publisher Metadata**

The next chapter will design the `dispatch_history` table, covering RabbitMQ publisher confirms, batch dispatching, message IDs, exchange and routing metadata, dispatch failures, publisher retries, correlation IDs, and how the Dispatcher reliably hands jobs from PostgreSQL to RabbitMQ without message loss.

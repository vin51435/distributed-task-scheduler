# Filename

**`V2-C06-Retry-Metadata-And-Retry-History.md`**

---

# Volume 2 — Database Design

# Chapter 6 — Retry Metadata & Retry History Design

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 6

**Filename:** `V2-C06-Retry-Metadata-And-Retry-History.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Retries Need Their Own Design
3. Retry Philosophy
4. Retry Architecture
5. Why Not Store Everything in Jobs?
6. Retry Metadata
7. Retry History
8. Retry Policies
9. Retry Scheduling
10. Failure Classification
11. Exponential Backoff
12. Jitter
13. Dead Letter Queue
14. Query Patterns
15. Constraints & Indexes
16. Complete SQL
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 6.1 Introduction

Distributed systems fail.

Failures are not exceptional—they are expected.

Examples include:

- Database temporarily unavailable
- RabbitMQ disconnected
- External API timeout
- SMTP server offline
- Payment gateway unavailable
- Network partition
- Worker crash

Most failures are temporary.

Immediately marking every failed execution as permanently failed would make the scheduler unreliable.

Instead, jobs should be retried according to configurable retry policies.

Retry logic is one of the most important reliability features of the scheduler.

---

# 6.2 Why Retries Need Their Own Design

Many simple schedulers only store:

```text
retry_count
```

inside the jobs table.

Example:

```text
Job

Retries = 3
```

This tells us:

- How many retries happened.

It does **not** tell us:

- Why retry occurred
- Previous execution times
- Previous errors
- Retry delay
- Backoff used
- Worker responsible
- Retry schedule

We need much more information.

---

# 6.3 Retry Philosophy

A retry is **not** a new job.

It is another execution attempt of the same job.

Example:

```text
Job #42

↓

Attempt 1

↓

Failed

↓

Attempt 2

↓

Failed

↓

Attempt 3

↓

Success
```

The job remains the same.

Only execution attempts change.

---

# 6.4 Retry Architecture

The scheduler separates:

```text
Job

↓

Execution Attempt

↓

Retry Attempt

↓

Execution History
```

Instead of duplicating jobs.

---

## Overall Flow

```text
Worker

↓

Execution Failed

↓

Determine Retry Policy

↓

Calculate Delay

↓

Update Job

↓

READY

↓

Scanner

↓

Dispatcher

↓

RabbitMQ

↓

Worker
```

RabbitMQ never delays retries.

PostgreSQL remains responsible for scheduling retries.

---

# 6.5 Why Not Create Another Job?

A common mistake:

```text
Job #42

↓

Failure

↓

Create Job #43
```

Problems:

- Duplicate audit history
- Lost execution history
- Broken idempotency
- Difficult debugging
- Duplicate notifications

Instead:

```text
Job #42

↓

Retry Count++

↓

Execute Again
```

One logical job.

Many execution attempts.

---

# 6.6 Retry Metadata in Jobs Table

The `jobs` table stores only the current retry state.

| Column             | Purpose          |
| ------------------ | ---------------- |
| retry_count        | Current attempts |
| max_retries        | Retry limit      |
| next_retry_at      | Next retry time  |
| last_retry_at      | Previous retry   |
| retry_strategy     | Policy           |
| last_error_code    | Last failure     |
| last_error_message | Summary          |

These values represent only the **latest** state.

Historical attempts belong elsewhere.

---

# 6.7 Retry History Table

Every retry attempt is recorded.

```text
scheduler.retry_history
```

Relationship:

```text
jobs

1

↓

N

retry_history
```

Example:

```text
Job 42

↓

Retry #1

↓

Retry #2

↓

Retry #3
```

---

# 6.8 Retry History Columns

| Column              | Type         | Description      |
| ------------------- | ------------ | ---------------- |
| id                  | UUID         | Retry record     |
| job_id              | UUID         | Related job      |
| attempt_number      | INTEGER      | Retry number     |
| worker_id           | UUID         | Executing worker |
| started_at          | TIMESTAMPTZ  | Execution start  |
| finished_at         | TIMESTAMPTZ  | Execution finish |
| duration_ms         | INTEGER      | Runtime          |
| error_code          | VARCHAR(100) | Failure code     |
| error_message       | TEXT         | Failure summary  |
| retry_delay_seconds | INTEGER      | Delay applied    |
| backoff_multiplier  | NUMERIC      | Backoff value    |
| jitter_ms           | INTEGER      | Random delay     |
| created_at          | TIMESTAMPTZ  | Record timestamp |

---

# 6.9 Retry Policies

Every job references a retry strategy.

Supported strategies:

---

## No Retry

```text
Failure

↓

DLQ
```

---

## Fixed Delay

```text
30s

30s

30s
```

---

## Linear Backoff

```text
30

60

90

120
```

---

## Exponential Backoff

```text
30

60

120

240

480
```

---

## Exponential with Jitter

```text
30

58

125

250

495
```

Preferred for distributed systems.

---

# 6.10 Failure Classification

Not every error should be retried.

---

## Retryable

Examples:

```text
Connection Timeout

RabbitMQ Down

SMTP Offline

503 Service Unavailable
```

---

## Non-Retryable

Examples:

```text
Validation Failed

Missing Payload

Unknown Handler

Malformed JSON
```

Those go directly to the DLQ.

---

# 6.11 Exponential Backoff

Formula:

```text
delay = base × (2^attempt)
```

Example:

Base:

```text
30 seconds
```

Attempts:

| Attempt | Delay   |
| ------- | ------- |
| 1       | 30 sec  |
| 2       | 60 sec  |
| 3       | 120 sec |
| 4       | 240 sec |
| 5       | 480 sec |

Exponential backoff prevents overloaded services from being hammered by immediate retries.

---

# 6.12 Why Jitter?

Suppose:

100,000 jobs fail simultaneously.

Without jitter:

```text
100,000

↓

Retry

↓

Exactly 30 Seconds Later
```

All workers wake simultaneously.

This is called a **Retry Storm** or **Thundering Herd**.

---

Instead:

```text
30

31

34

28

29

33

27
```

Each retry occurs slightly differently.

This spreads system load.

---

# 6.13 Dead Letter Queue

Eventually retries stop.

```text
Retry Limit

↓

Exceeded

↓

Dead Letter Queue
```

Job status:

```text
FAILED

↓

DLQ
```

No additional retries occur.

Operators may manually:

- replay
- inspect
- delete
- archive

---

# 6.14 Retry Timeline

Example:

```text
09:00

Execution

↓

Failed

↓

Retry

09:00:30

↓

Failed

↓

Retry

09:01:30

↓

Failed

↓

Retry

09:03:30

↓

Success
```

Every attempt appears inside `retry_history`.

---

# 6.15 Query Patterns

Find jobs ready for retry:

```sql
SELECT *
FROM scheduler.jobs
WHERE next_retry_at <= NOW()
AND status = 'READY';
```

---

Retry history:

```sql
SELECT *
FROM scheduler.retry_history
WHERE job_id = $1
ORDER BY attempt_number;
```

---

Failed retries:

```sql
SELECT *
FROM scheduler.retry_history
WHERE error_code='SMTP_TIMEOUT';
```

---

Longest retries:

```sql
SELECT *
FROM scheduler.retry_history
ORDER BY duration_ms DESC;
```

---

# 6.16 Index Strategy

Jobs:

```sql
(status, next_retry_at)
```

Retry History:

```sql
(job_id)
```

Worker:

```sql
(worker_id)
```

Error:

```sql
(error_code)
```

Created:

```sql
(created_at)
```

Composite:

```sql
(job_id, attempt_number)
```

---

# 6.17 Constraints

Primary Key:

```sql
PRIMARY KEY(id)
```

Foreign Key:

```sql
job_id REFERENCES scheduler.jobs(id)
```

Check:

```sql
attempt_number > 0
```

Check:

```sql
duration_ms >= 0
```

Check:

```sql
retry_delay_seconds >= 0
```

---

# 6.18 Initial SQL Definition

```sql
CREATE TABLE scheduler.retry_history (

    id UUID PRIMARY KEY,

    job_id UUID NOT NULL
        REFERENCES scheduler.jobs(id),

    worker_id UUID,

    attempt_number INTEGER NOT NULL,

    started_at TIMESTAMPTZ,

    finished_at TIMESTAMPTZ,

    duration_ms INTEGER,

    error_code VARCHAR(100),

    error_message TEXT,

    retry_delay_seconds INTEGER,

    backoff_multiplier NUMERIC(10,2),

    jitter_ms INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 6.19 Why Two Tables?

Many people ask:

> Why not put everything inside `jobs`?

Because:

Jobs represent **current state**.

Retry History represents **past events**.

Example:

```text
Jobs

Current Retry = 3

↓

Retry History

Attempt 1

Attempt 2

Attempt 3
```

Separating current state from historical events keeps the `jobs` table small and optimized for scheduling, while preserving complete retry history for debugging and auditing.

---

# 6.20 Future Evolution

```text
Basic Retry Count

↓

Retry History

↓

Configurable Policies

↓

Distributed Retry Analytics

↓

AI-Based Retry Optimization
```

Future versions could automatically adjust retry policies based on historical success rates.

---

# 6.21 Best Practices

- Never duplicate jobs for retries.
- Keep retry metadata in the `jobs` table.
- Store every attempt in `retry_history`.
- Retry only transient failures.
- Use exponential backoff by default.
- Always add jitter to distributed retries.
- Stop after a configurable limit.
- Move permanently failed jobs to the DLQ.
- Keep retry history immutable.
- Index retry queries for fast scheduling.

---

# Chapter Summary

This chapter designed the retry persistence model for the Distributed Task Scheduler Platform. We separated current retry state from historical retry events, defined the `retry_history` table, explained retry policies, failure classification, exponential backoff, jitter, dead-letter routing, query patterns, indexes, constraints, and provided an initial SQL schema. By treating retries as repeated execution attempts of the same job rather than new jobs, the platform preserves consistency, simplifies debugging, and provides a reliable foundation for fault-tolerant scheduling.

---

# Next Chapter

**Filename:** `V2-C07-Idempotency-Storage.md`

**Chapter 7 — Idempotency Storage Design**

The next chapter will design the persistence model for idempotency, including idempotency keys, cached execution results, expiration policies, Redis integration, PostgreSQL persistence, duplicate detection, race-condition handling, and the interaction between Workers, the `jobs` table, and idempotency storage.

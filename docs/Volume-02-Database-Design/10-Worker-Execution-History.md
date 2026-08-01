# Filename

**`V2-C10-Worker-Execution-History.md`**

---

# Volume 2 — Database Design

# Chapter 10 — Worker Execution History Design

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 10

**Filename:** `V2-C10-Worker-Execution-History.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Execution History Exists
3. Execution vs Job vs Retry
4. Execution Architecture
5. Execution Lifecycle
6. Execution History Table
7. Column-by-Column Design
8. Execution States
9. Resource Metrics
10. Worker Metadata
11. Correlation & Tracing
12. Query Patterns
13. Constraints & Indexes
14. Complete SQL
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 10.1 Introduction

When a Worker receives a job from RabbitMQ, it begins executing business logic.

Examples:

- Send an email
- Process a payment
- Generate a PDF
- Resize an image
- Invoke an external API
- Generate an invoice

Simply knowing that a job is **COMPLETED** is insufficient.

Production systems need to answer questions such as:

- Which worker executed it?
- How long did it take?
- Did it consume excessive memory?
- Which exception occurred?
- Which retry succeeded?
- Which trace belongs to this execution?
- What result was returned?

This information belongs in the **Execution History**.

---

# 10.2 Why Execution History Exists

Suppose a customer reports:

> "My invoice email took 30 seconds yesterday."

Without execution history:

```text
Job

↓

COMPLETED
```

No other information exists.

With execution history:

```text
Job

↓

Execution

↓

Duration

↓

Worker

↓

Memory

↓

Trace

↓

Result
```

Complete diagnostics become available.

---

# 10.3 Job vs Retry vs Execution

Many engineers initially confuse these concepts.

They represent different things.

## Job

Represents business work.

Example:

```text
Generate Invoice
```

Stored in:

```text
scheduler.jobs
```

---

## Retry

Represents another attempt after failure.

Stored in:

```text
scheduler.retry_history
```

---

## Execution

Represents **every single worker execution**, regardless of success or failure.

Stored in:

```text
scheduler.execution_history
```

Relationship:

```text
Job

↓

Execution 1

↓

Execution 2

↓

Execution 3
```

Every retry creates another execution record.

---

# 10.4 Execution Architecture

```text
RabbitMQ

↓

Worker

↓

Execution History

↓

Business Logic

↓

Result

↓

ACK
```

Execution history records everything that happened during processing.

---

# 10.5 Execution Lifecycle

```text
RECEIVED

↓

STARTED

↓

PROCESSING

↓

COMPLETED
```

Failure:

```text
STARTED

↓

FAILED
```

Cancellation:

```text
STARTED

↓

CANCELLED
```

Timeout:

```text
STARTED

↓

TIMED_OUT
```

---

# 10.6 Table Structure

```text
scheduler.execution_history

├── Identity
├── References
├── Worker Information
├── Timing
├── Execution State
├── Resource Metrics
├── Result
├── Exception
├── Tracing
└── Audit
```

---

# 10.7 Complete Column Design

## Identity

| Column | Type | Description      |
| ------ | ---- | ---------------- |
| id     | UUID | Execution record |

---

## References

| Column        | Type |
| ------------- | ---- |
| job_id        | UUID |
| retry_id      | UUID |
| dispatcher_id | UUID |

---

## Worker

| Column      | Type         |
| ----------- | ------------ |
| worker_id   | UUID         |
| worker_name | VARCHAR(255) |
| handler     | VARCHAR(255) |
| node_name   | VARCHAR(255) |

---

## Timing

| Column      | Type        |
| ----------- | ----------- |
| received_at | TIMESTAMPTZ |
| started_at  | TIMESTAMPTZ |
| finished_at | TIMESTAMPTZ |
| duration_ms | INTEGER     |

---

## Execution

| Column         | Type             |
| -------------- | ---------------- |
| status         | execution_status |
| attempt_number | INTEGER          |

---

## Resource Usage

| Column             | Type    |
| ------------------ | ------- |
| cpu_time_ms        | INTEGER |
| memory_bytes       | BIGINT  |
| payload_size_bytes | INTEGER |

---

## Result

| Column      | Type         |
| ----------- | ------------ |
| response    | JSONB        |
| result_code | VARCHAR(100) |

---

## Exception

| Column         | Type         |
| -------------- | ------------ |
| exception_type | VARCHAR(255) |
| error_code     | VARCHAR(100) |
| error_message  | TEXT         |
| stack_trace    | TEXT         |

---

## Tracing

| Column         | Type |
| -------------- | ---- |
| trace_id       | UUID |
| span_id        | UUID |
| correlation_id | UUID |

---

## Audit

| Column     | Type        |
| ---------- | ----------- |
| created_at | TIMESTAMPTZ |

---

# 10.8 Why Each Column Exists

## worker_id

Suppose Worker #4 crashes repeatedly.

Query:

```sql
SELECT *
FROM scheduler.execution_history
WHERE worker_id = 'worker-4';
```

Instant diagnostics become possible.

---

## handler

Workers execute many handlers.

Example:

```text
email.send

↓

invoice.generate

↓

cleanup.logs

↓

payment.capture
```

The handler identifies which business logic executed.

---

## duration_ms

Performance monitoring.

Example:

| Handler         | Average |
| --------------- | ------- |
| email.send      | 150 ms  |
| payment.capture | 450 ms  |
| generate.pdf    | 3 sec   |

Slow handlers become visible.

---

## response

Example:

```json
{
  "invoiceId": "INV-1024",
  "status": "SUCCESS"
}
```

Useful for diagnostics.

---

## stack_trace

Suppose:

```text
SMTP Timeout
```

Instead of only:

```text
Timeout
```

Store complete stack trace.

Developers can debug production failures much faster.

---

# 10.9 Resource Metrics

Workers collect lightweight metrics.

Example:

Memory:

```text
42 MB
```

CPU:

```text
180 ms
```

Payload:

```text
14 KB
```

These metrics help identify expensive handlers.

---

# 10.10 Execution Timeline

```text
RabbitMQ

↓

Worker Received

↓

Execution Record Created

↓

Handler Started

↓

Business Logic

↓

Completed

↓

ACK RabbitMQ
```

The execution record exists before business logic begins.

This ensures failures are still recorded.

---

# 10.11 Correlation & Tracing

Every execution belongs to a distributed trace.

Example:

```text
REST Request

↓

API Gateway

↓

Timer

↓

Dispatcher

↓

RabbitMQ

↓

Worker

↓

SMTP
```

All services share:

```text
trace_id
```

This enables OpenTelemetry to reconstruct the complete request path.

---

# 10.12 Relationship Diagram

```text
jobs

    │

    │ 1

    ▼

execution_history

    │

    │ N

    ▼

retry_history
```

One job produces many executions.

Retries create additional execution records.

---

# 10.13 Query Patterns

Execution history:

```sql
SELECT *
FROM scheduler.execution_history
WHERE job_id=$1;
```

Slow executions:

```sql
SELECT *
FROM scheduler.execution_history
WHERE duration_ms > 5000;
```

Worker diagnostics:

```sql
SELECT *
FROM scheduler.execution_history
WHERE worker_id=$1;
```

Failed executions:

```sql
SELECT *
FROM scheduler.execution_history
WHERE status='FAILED';
```

Tracing:

```sql
SELECT *
FROM scheduler.execution_history
WHERE trace_id=$1;
```

---

# 10.14 Constraints

Primary Key

```sql
PRIMARY KEY(id)
```

Foreign Key

```sql
job_id
REFERENCES scheduler.jobs(id)
```

Foreign Key

```sql
retry_id
REFERENCES scheduler.retry_history(id)
```

Check

```sql
duration_ms >= 0
```

Check

```sql
memory_bytes >= 0
```

Check

```sql
cpu_time_ms >= 0
```

---

# 10.15 Index Strategy

Primary lookup:

```text
(job_id)
```

Worker:

```text
(worker_id)
```

Status:

```text
(status)
```

Duration:

```text
(duration_ms)
```

Trace:

```text
(trace_id)
```

Correlation:

```text
(correlation_id)
```

Created:

```text
(created_at)
```

Composite:

```text
(worker_id, status)
```

Composite:

```text
(handler, duration_ms)
```

Useful for performance reports.

---

# 10.16 Initial SQL Definition

```sql
CREATE TABLE scheduler.execution_history (

    id UUID PRIMARY KEY,

    job_id UUID NOT NULL
        REFERENCES scheduler.jobs(id),

    retry_id UUID
        REFERENCES scheduler.retry_history(id),

    dispatcher_id UUID,

    worker_id UUID,

    worker_name VARCHAR(255),

    node_name VARCHAR(255),

    handler VARCHAR(255),

    status execution_status,

    attempt_number INTEGER,

    received_at TIMESTAMPTZ,

    started_at TIMESTAMPTZ,

    finished_at TIMESTAMPTZ,

    duration_ms INTEGER,

    cpu_time_ms INTEGER,

    memory_bytes BIGINT,

    payload_size_bytes INTEGER,

    response JSONB,

    result_code VARCHAR(100),

    exception_type VARCHAR(255),

    error_code VARCHAR(100),

    error_message TEXT,

    stack_trace TEXT,

    trace_id UUID,

    span_id UUID,

    correlation_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 10.17 Why Separate Execution History?

Many systems simply update:

```text
jobs.status

↓

COMPLETED
```

That tells us only the current state.

Execution history provides:

- Performance analysis
- Worker diagnostics
- Exception debugging
- SLA monitoring
- Capacity planning
- Business analytics
- Distributed tracing
- Retry investigation

Without enlarging the frequently updated `jobs` table.

---

# 10.18 Execution vs Retry History

This distinction is important.

## retry_history

Answers:

> **Why did we retry?**

Contains:

- retry delay
- retry policy
- backoff
- jitter

---

## execution_history

Answers:

> **What happened while executing?**

Contains:

- duration
- memory
- CPU
- response
- exceptions
- tracing

These tables complement each other.

---

# 10.19 Future Evolution

```text
Basic Execution

↓

Tracing

↓

Resource Metrics

↓

Performance Profiling

↓

Flame Graphs

↓

Distributed Profiling

↓

AI Performance Analysis
```

Execution history becomes increasingly valuable as the platform grows.

---

# 10.20 Best Practices

- Record execution before business logic starts.
- Never overwrite execution history.
- Store performance metrics.
- Record exceptions completely.
- Capture trace identifiers.
- Separate execution history from retry history.
- Index slow-query fields.
- Archive old execution history.
- Keep execution records immutable.
- Use execution data for capacity planning.

---

# Chapter Summary

This chapter designed the `scheduler.execution_history` table, which records every execution performed by Workers. We distinguished execution history from job state and retry history, designed the table structure, explored worker metadata, execution timing, resource metrics, exception storage, distributed tracing, query patterns, indexing strategies, and provided a complete SQL definition. This table forms the operational record of all business logic execution and is essential for debugging, monitoring, performance analysis, and production observability.

---

# Next Chapter

**Filename:** `V2-C11-Dead-Letter-Queue-Storage.md`

**Chapter 11 — Dead Letter Queue (DLQ) Storage Design**

The next chapter will design how permanently failed jobs are stored and managed after exhausting all retry attempts. It will cover the `dead_letter_jobs` table, failure categorization, replay workflows, manual intervention, archival, operational dashboards, and the relationship between the DLQ, retry system, Workers, and the `jobs` table.

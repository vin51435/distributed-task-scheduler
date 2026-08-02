# Filename

**`V2-C11-Dead-Letter-Queue-Storage.md`**

---

# Volume 2 — Database Design

# Chapter 11 — Dead Letter Queue (DLQ) Storage Design

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 11

**Filename:** `V2-C11-Dead-Letter-Queue-Storage.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Dead Letter Queues Exist
3. Failure Types
4. DLQ Architecture
5. Job Lifecycle
6. Dead Letter Jobs Table
7. Column-by-Column Design
8. Failure Classification
9. Replay Workflow
10. Manual Intervention
11. Archival Strategy
12. Query Patterns
13. Constraints & Indexes
14. Complete SQL
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 11.1 Introduction

Even the most reliable distributed systems encounter jobs that **cannot** be completed.

Examples include:

- Invalid business data
- Deleted customer accounts
- Corrupted payloads
- Missing external resources
- Unknown handlers
- Business rule violations
- Retry limit exceeded

Continuing to retry these jobs wastes resources and can overload dependent systems.

Instead, permanently failed jobs are moved to a **Dead Letter Queue (DLQ)** for inspection and possible manual recovery.

The DLQ acts as a **quarantine area** for jobs that require human attention or special handling.

---

# 11.2 Why Dead Letter Queues Exist

Without a DLQ:

```text id="4mlv8n"
Job

↓

Fail

↓

Retry

↓

Fail

↓

Retry

↓

Forever
```

This causes:

- Endless retries
- Queue congestion
- Resource exhaustion
- Duplicate alerts
- Increased infrastructure costs

Instead:

```text id="9ck9mk"
Job

↓

Retry

↓

Retry

↓

Retry

↓

DLQ
```

The system remains healthy while preserving failed jobs for later analysis.

---

# 11.3 Failure Types

Failures generally fall into two categories.

## Transient Failures

These may succeed if retried.

Examples:

```text id="jv9zpb"
SMTP Offline

503 Service Unavailable

Temporary Network Failure

RabbitMQ Restart
```

These follow the retry policy.

---

## Permanent Failures

These will not succeed without changes.

Examples:

```text id="zqf1or"
Unknown Handler

Invalid Payload

Business Validation Failed

Missing Customer

Corrupted Data
```

These should move directly to the DLQ.

---

# 11.4 DLQ Architecture

```text id="q6v4z9"
Worker

↓

Execution Failed

↓

Retry Policy

↓

Retries Remaining?

↓

YES

↓

Retry

↓

NO

↓

Dead Letter Queue
```

The DLQ is **not** RabbitMQ's DLQ.

RabbitMQ's Dead Letter Exchange handles messaging failures.

Our `dead_letter_jobs` table stores **business failures**.

---

# 11.5 Job Lifecycle

```text id="l3ahpt"
READY

↓

RUNNING

↓

FAILED

↓

Retry

↓

FAILED

↓

Retry

↓

FAILED

↓

DLQ
```

Once inside the DLQ:

```text id="rjhlkl"
Inspect

↓

Replay

OR

Archive

OR

Delete
```

---

# 11.6 Why Use a Separate Table?

A common approach:

```text id="6fgz91"
jobs.status

↓

DLQ
```

Problems:

- Jobs table grows indefinitely
- Scheduler scans unnecessary rows
- Operational queries slow down
- Active jobs mixed with dead jobs

Instead:

```text id="ex0r6n"
jobs

↓

Move

↓

dead_letter_jobs
```

Active scheduling remains efficient.

---

# 11.7 Table Structure

```text id="2hz43q"
scheduler.dead_letter_jobs

├── Identity
├── Original Job
├── Failure Information
├── Retry Summary
├── Replay Metadata
├── Ownership
└── Audit
```

---

# 11.8 Complete Column Design

## Identity

| Column | Type | Description |
| ------ | ---- | ----------- |
| id     | UUID | DLQ record  |

---

## Original Job

| Column    | Type         |
| --------- | ------------ |
| job_id    | UUID         |
| tenant_id | UUID         |
| handler   | VARCHAR(255) |
| payload   | JSONB        |

---

## Failure

| Column           | Type             |
| ---------------- | ---------------- |
| failure_category | failure_category |
| error_code       | VARCHAR(100)     |
| error_message    | TEXT             |
| stack_trace      | TEXT             |

---

## Retry Summary

| Column        | Type        |
| ------------- | ----------- |
| retry_count   | INTEGER     |
| max_retries   | INTEGER     |
| last_retry_at | TIMESTAMPTZ |

---

## Replay

| Column       | Type        |
| ------------ | ----------- |
| replay_count | INTEGER     |
| replayed_by  | UUID        |
| replayed_at  | TIMESTAMPTZ |

---

## Ownership

| Column    | Type         |
| --------- | ------------ |
| worker_id | UUID         |
| node_name | VARCHAR(255) |

---

## Audit

| Column      | Type        |
| ----------- | ----------- |
| created_at  | TIMESTAMPTZ |
| archived_at | TIMESTAMPTZ |

---

# 11.9 Why Each Column Exists

## failure_category

Grouping failures simplifies operations.

Examples:

```text id="xv0m2o"
VALIDATION

NETWORK

BUSINESS

TIMEOUT

UNKNOWN_HANDLER

SYSTEM
```

Operators can prioritize fixes.

---

## replay_count

Some jobs are replayed multiple times.

Example:

```text id="uhg5z7"
Original Failure

↓

Replay

↓

Failure

↓

Replay

↓

Success
```

Tracking replay attempts helps detect recurring problems.

---

## stack_trace

Developers often need the complete exception.

Instead of:

```text id="sjpqdb"
Timeout
```

Store:

```text id="h1hxtf"
Complete Stack Trace
```

to diagnose production issues quickly.

---

# 11.10 Failure Classification

Example categories:

| Category          | Retry?     | DLQ?          |
| ----------------- | ---------- | ------------- |
| Network           | Yes        | After retries |
| SMTP              | Yes        | After retries |
| Validation        | No         | Immediate     |
| Missing Handler   | No         | Immediate     |
| Corrupted Payload | No         | Immediate     |
| Business Rule     | Usually No | Immediate     |
| Timeout           | Yes        | After retries |

---

# 11.11 Replay Workflow

Replay does **not** edit the original DLQ record.

Workflow:

```text id="5eh8ja"
DLQ Record

↓

Operator Clicks Replay

↓

Create NEW Job

↓

Jobs Table

↓

Normal Scheduling Flow
```

The DLQ entry remains for audit purposes.

Replay creates a new job with a reference to the original failure.

---

# 11.12 Manual Intervention

Operators may:

```text id="qzgmqg"
View Payload

↓

View Stack Trace

↓

Edit Business Data

↓

Replay

OR

Archive

OR

Delete
```

The scheduler should expose administrative APIs for these operations.

---

# 11.13 Relationship Diagram

```text id="sg6mf9"
jobs

    │

    ▼

execution_history

    │

    ▼

retry_history

    │

    ▼

dead_letter_jobs

    │

    ▼

Replay

    │

    ▼

New Job
```

The original job and replayed job remain linked for traceability.

---

# 11.14 Query Patterns

Find DLQ jobs:

```sql id="1gwrxw"
SELECT *
FROM scheduler.dead_letter_jobs;
```

Find validation failures:

```sql id="ooxv7b"
SELECT *
FROM scheduler.dead_letter_jobs
WHERE failure_category='VALIDATION';
```

Find replay candidates:

```sql id="7jlwmq"
SELECT *
FROM scheduler.dead_letter_jobs
WHERE replay_count=0;
```

Tenant failures:

```sql id="pc8q6h"
SELECT *
FROM scheduler.dead_letter_jobs
WHERE tenant_id=$1;
```

Recent failures:

```sql id="y7z4u8"
SELECT *
FROM scheduler.dead_letter_jobs
ORDER BY created_at DESC;
```

---

# 11.15 Constraints

Primary Key:

```sql id="0ln4ps"
PRIMARY KEY(id)
```

Foreign Key:

```sql id="zivpp8"
job_id
REFERENCES scheduler.jobs(id)
```

Check:

```sql id="xyuq7r"
retry_count >= 0
```

Check:

```sql id="y5g59j"
max_retries >= retry_count
```

Check:

```sql id="lwswpy"
replay_count >= 0
```

---

# 11.16 Index Strategy

Primary lookup:

```text id="t4wnbm"
(job_id)
```

Tenant:

```text id="t2f6z0"
(tenant_id)
```

Category:

```text id="f2sgwa"
(failure_category)
```

Worker:

```text id="0g4y1o"
(worker_id)
```

Replay:

```text id="cjlwmc"
(replay_count)
```

Created:

```text id="nk0p4u"
(created_at)
```

Composite:

```text id="u1mlyp"
(failure_category, created_at)
```

Useful for operational dashboards.

---

# 11.17 Initial SQL Definition

```sql id="5u33kk"
CREATE TABLE scheduler.dead_letter_jobs (

    id UUID PRIMARY KEY,

    job_id UUID NOT NULL
        REFERENCES scheduler.jobs(id),

    tenant_id UUID NOT NULL,

    handler VARCHAR(255),

    payload JSONB,

    failure_category failure_category,

    error_code VARCHAR(100),

    error_message TEXT,

    stack_trace TEXT,

    retry_count INTEGER,

    max_retries INTEGER,

    last_retry_at TIMESTAMPTZ,

    replay_count INTEGER DEFAULT 0,

    replayed_by UUID,

    replayed_at TIMESTAMPTZ,

    worker_id UUID,

    node_name VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    archived_at TIMESTAMPTZ
);
```

---

# 11.18 Why Keep the Original Job?

The original `jobs` record should **not** be deleted immediately.

Instead:

```text id="8lgb1v"
jobs

↓

Status = DLQ

↓

Copied

↓

dead_letter_jobs
```

Later, an archival process can remove inactive jobs after retention policies are met.

This preserves referential integrity for:

- execution history
- retry history
- dispatch history
- audit records

---

# 11.19 Operational Dashboard

Typical DLQ dashboard:

| Metric              | Purpose                    |
| ------------------- | -------------------------- |
| Total DLQ Jobs      | Current backlog            |
| Validation Failures | Data quality issues        |
| Network Failures    | Infrastructure health      |
| Replay Success Rate | Operational efficiency     |
| Oldest DLQ Job      | SLA monitoring             |
| Top Failing Handler | Engineering prioritization |
| DLQ Growth Rate     | Capacity planning          |

---

# 11.20 Future Evolution

```text id="i5i9r2"
Basic DLQ

↓

Replay Support

↓

Bulk Replay

↓

Automatic Classification

↓

AI Failure Analysis

↓

Self-Healing Recovery
```

Future versions may automatically classify failures and recommend recovery actions.

---

# 11.21 Best Practices

- Never retry indefinitely.
- Separate active jobs from dead jobs.
- Preserve the complete failure context.
- Classify failures consistently.
- Record replay history.
- Never modify historical failure records.
- Allow replay by creating a new job.
- Archive old DLQ entries.
- Monitor DLQ growth continuously.
- Build operational dashboards around DLQ metrics.

---

# Chapter Summary

This chapter designed the `scheduler.dead_letter_jobs` table, which stores permanently failed jobs after retry exhaustion or non-retryable failures. We explored failure classification, replay workflows, manual intervention, table design, constraints, indexing, operational dashboards, and the relationship between DLQ records and the rest of the scheduling system. By isolating unrecoverable jobs from the active scheduling pipeline, the platform maintains performance while providing operators with the tools needed to investigate, replay, or archive failed work.

---

# Next Chapter

**Filename:** `V2-C12-Notification-Storage.md`

**Chapter 12 — Notification Storage Design**

The next chapter will design the persistence model for notifications, including templates, delivery attempts, email history, SMS history, webhook delivery tracking, notification retries, provider responses, and how the Notification Service stores communication records independently of job execution.

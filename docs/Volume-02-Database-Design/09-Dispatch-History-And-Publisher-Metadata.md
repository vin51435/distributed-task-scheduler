# Filename

**`V2-C09-Dispatch-History-And-Publisher-Metadata.md`**

---

# Volume 2 — Database Design

# Chapter 9 — Dispatch History & Publisher Metadata

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 9

**Filename:** `V2-C09-Dispatch-History-And-Publisher-Metadata.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Dispatch History Exists
3. The Dispatch Problem
4. Dispatch Architecture
5. Dispatch Lifecycle
6. Current State vs Historical State
7. Dispatch History Table
8. Publisher Metadata
9. RabbitMQ Publisher Confirms
10. Batch Dispatching
11. Failure Recovery
12. Dispatcher Ownership
13. Query Patterns
14. Constraints & Indexes
15. Complete SQL
16. Future Evolution
17. Best Practices
18. Chapter Summary

---

# 9.1 Introduction

The Dispatcher is the bridge between the **Scheduling Plane** and the **Execution Plane**.

Scheduling Plane:

```text
PostgreSQL

↓

Scanner

↓

Dispatcher
```

Execution Plane:

```text
RabbitMQ

↓

Workers
```

The Dispatcher has one responsibility:

> Safely move executable jobs from PostgreSQL into RabbitMQ without losing or duplicating work.

This chapter designs the database tables that record **every dispatch operation**.

---

# 9.2 Why Dispatch History Exists

A common mistake is:

```text
Scanner

↓

RabbitMQ

↓

Done
```

No record exists showing:

- Who dispatched the job
- When it was dispatched
- Which exchange received it
- Which routing key was used
- Whether RabbitMQ acknowledged the publish
- How many publish attempts occurred

If RabbitMQ later reports problems, there is no historical evidence.

Instead:

```text
Dispatcher

↓

Dispatch History

↓

RabbitMQ
```

Every publish operation becomes traceable.

---

# 9.3 The Dispatch Problem

Consider this sequence:

```text
Dispatcher

↓

Publish Message

↓

RabbitMQ Receives

↓

Network Failure
```

Did RabbitMQ receive the message?

Maybe.

Did the Dispatcher receive the ACK?

No.

Should the Dispatcher publish again?

If it republishes blindly:

```text
Job

↓

RabbitMQ

↓

Worker

↓

Duplicate Execution
```

We need persistent metadata describing exactly what happened.

---

# 9.4 Dispatch Architecture

```text
Scanner

↓

Reserve Jobs

↓

Dispatcher

↓

Insert Dispatch Record

↓

RabbitMQ Publish

↓

Publisher Confirm

↓

Update Dispatch History

↓

Mark Job DISPATCHED
```

Dispatch history becomes the audit trail for every publish operation.

---

# 9.5 Dispatch Lifecycle

```text
NEW

↓

PREPARING

↓

PUBLISHED

↓

CONFIRMED

↓

DELIVERED
```

Failure path:

```text
NEW

↓

PUBLISH FAILED

↓

RETRY

↓

CONFIRMED
```

---

# 9.6 Current State vs Historical State

The `jobs` table stores:

```text
Current Status

↓

DISPATCHED
```

The `dispatch_history` table stores:

```text
Attempt 1

Attempt 2

Attempt 3
```

Exactly like retry history.

Current state and historical events are separated.

---

# 9.7 Table Structure

```text
scheduler.dispatch_history

├── Identity
├── Job Reference
├── Publisher Metadata
├── RabbitMQ Metadata
├── Dispatch Status
├── Timing
├── Failure Information
└── Audit
```

---

# 9.8 Complete Column Design

## Identity

| Column | Type | Description |
| ------ | ---- | ----------- |
| id     | UUID | Primary key |

---

## References

| Column        | Type |
| ------------- | ---- |
| job_id        | UUID |
| dispatcher_id | UUID |
| scanner_id    | UUID |

---

## RabbitMQ

| Column        | Type         |
| ------------- | ------------ |
| exchange_name | VARCHAR(255) |
| routing_key   | VARCHAR(255) |
| queue_name    | VARCHAR(255) |
| message_id    | UUID         |

---

## Publish

| Column              | Type            |
| ------------------- | --------------- |
| publish_attempt     | INTEGER         |
| publish_status      | dispatch_status |
| publisher_confirmed | BOOLEAN         |

---

## Timing

| Column       | Type        |
| ------------ | ----------- |
| published_at | TIMESTAMPTZ |
| confirmed_at | TIMESTAMPTZ |

---

## Failure

| Column        | Type         |
| ------------- | ------------ |
| error_code    | VARCHAR(100) |
| error_message | TEXT         |

---

## Audit

| Column     | Type        |
| ---------- | ----------- |
| created_at | TIMESTAMPTZ |

---

# 9.9 Why Each Column Exists

## message_id

RabbitMQ messages receive unique identifiers.

Example:

```text
Message

↓

8e3d...

```

Used for:

- tracing
- duplicate detection
- debugging

---

## exchange_name

Example:

```text
scheduler.jobs
```

Different job types may use different exchanges.

Historical storage simplifies troubleshooting.

---

## routing_key

Example:

```text
email.high

invoice.low

webhook.default
```

Workers subscribe using routing keys.

Recording them helps explain delivery behavior.

---

## publisher_confirmed

RabbitMQ Publisher Confirms tell us whether the broker persisted the message.

```text
Dispatcher

↓

Publish

↓

RabbitMQ

↓

ACK
```

If confirmation never arrives:

Dispatcher knows publishing was unsuccessful.

---

# 9.10 Publisher Confirms

Publishing is asynchronous.

```text
Publish

↓

RabbitMQ

↓

Persist

↓

ACK
```

Dispatcher waits.

If ACK arrives:

```text
publisher_confirmed = true
```

Otherwise:

```text
Retry Publish
```

This prevents silent message loss.

---

# 9.11 Batch Dispatching

Dispatcher rarely publishes one job.

Instead:

```text
500 Jobs

↓

Batch Publish

↓

RabbitMQ

↓

500 Publisher Confirms
```

Each job still receives its own dispatch history record.

Batching improves throughput while preserving traceability.

---

# 9.12 Failure Recovery

Suppose RabbitMQ becomes unavailable.

```text
Dispatcher

↓

Publish

↓

Connection Lost
```

History becomes:

```text
Status

↓

FAILED
```

Later:

```text
Dispatcher

↓

Retry Publish

↓

CONFIRMED
```

Every attempt is preserved.

---

# 9.13 Dispatcher Ownership

Multiple Dispatcher instances may run.

```text
Dispatcher A

↓

Job 100
```

Dispatcher B:

```text
Job 101
```

Ownership information:

```text
dispatcher_id
```

makes troubleshooting significantly easier.

---

# 9.14 Dispatch Timeline

```text
Scanner

↓

Lease

↓

Dispatcher

↓

Publish

↓

Publisher Confirm

↓

Job Status

↓

DISPATCHED
```

Dispatch history records every timestamp.

---

# 9.15 Query Patterns

Dispatch history:

```sql
SELECT *
FROM scheduler.dispatch_history
WHERE job_id = $1;
```

Failed publishes:

```sql
SELECT *
FROM scheduler.dispatch_history
WHERE publish_status='FAILED';
```

Dispatcher metrics:

```sql
SELECT *
FROM scheduler.dispatch_history
WHERE dispatcher_id=$1;
```

Publisher confirmation lag:

```sql
SELECT confirmed_at-published_at
FROM scheduler.dispatch_history;
```

---

# 9.16 Constraints

Primary Key:

```sql
PRIMARY KEY(id)
```

Foreign Key:

```sql
job_id
REFERENCES scheduler.jobs(id)
```

Check:

```sql
publish_attempt > 0
```

Check:

```sql
confirmed_at >= published_at
```

---

# 9.17 Index Strategy

Primary lookup:

```text
(job_id)
```

Dispatcher:

```text
(dispatcher_id)
```

Message:

```text
(message_id)
```

Publish status:

```text
(publish_status)
```

Published time:

```text
(published_at)
```

Composite:

```text
(job_id, publish_attempt)
```

---

# 9.18 Initial SQL Definition

```sql
CREATE TABLE scheduler.dispatch_history (

    id UUID PRIMARY KEY,

    job_id UUID NOT NULL
        REFERENCES scheduler.jobs(id),

    dispatcher_id UUID,

    scanner_id UUID,

    exchange_name VARCHAR(255),

    queue_name VARCHAR(255),

    routing_key VARCHAR(255),

    message_id UUID,

    publish_attempt INTEGER DEFAULT 1,

    publish_status dispatch_status,

    publisher_confirmed BOOLEAN DEFAULT FALSE,

    published_at TIMESTAMPTZ,

    confirmed_at TIMESTAMPTZ,

    error_code VARCHAR(100),

    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 9.19 Relationship Diagram

```text
jobs

    │

    │ 1

    ▼

dispatch_history

    │

    │ N

    ▼

RabbitMQ
```

One job may require multiple publish attempts.

Each attempt is recorded independently.

---

# 9.20 Why Separate Dispatch History?

Some systems simply update:

```text
jobs.status

↓

DISPATCHED
```

This loses:

- publish failures
- retry attempts
- exchange information
- routing metadata
- confirmation latency

Keeping dispatch history separate provides:

- observability
- debugging
- auditing
- performance analytics

without bloating the `jobs` table.

---

# 9.21 Future Evolution

```text
Basic Publish

↓

Publisher Confirms

↓

Batch Publishing

↓

Exactly-Once Outbox

↓

Transactional Messaging

↓

Cross-Region Dispatch
```

In a future version, the Dispatcher may adopt the **Transactional Outbox Pattern**, allowing database commits and message publication to be coordinated more reliably.

---

# 9.22 Best Practices

- Never publish without recording dispatch metadata.
- Wait for Publisher Confirms before marking dispatch successful.
- Record every publish attempt.
- Store RabbitMQ routing information.
- Keep dispatch history immutable.
- Batch publishes for throughput.
- Retry only failed publishes.
- Correlate dispatch records with tracing IDs.
- Monitor publish confirmation latency.
- Archive old dispatch history periodically.

---

# Chapter Summary

This chapter designed the `scheduler.dispatch_history` table and the persistence model for reliable message publication. We examined how the Dispatcher safely transfers jobs from PostgreSQL to RabbitMQ, why Publisher Confirms are essential, how dispatch attempts are recorded, how failures are retried, and why dispatch history is separated from the `jobs` table. This design provides full observability into the transition from scheduling to execution while preventing silent message loss.

---

# Next Chapter

**Filename:** `V2-C10-Worker-Execution-History.md`

**Chapter 10 — Worker Execution History Design**

The next chapter will design the `execution_history` table, which records every execution attempt performed by Workers. It will cover execution states, execution timing, handler information, CPU and memory metrics, execution outputs, exceptions, retry linkage, correlation IDs, tracing integration, and how execution history differs from retry history and audit history.

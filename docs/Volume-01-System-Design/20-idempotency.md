# Chapter 20 — Idempotency & Effectively-Once Processing

**Document:** Distributed Task Scheduler Platform
**Chapter:** 20
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Idempotency Matters
3. Exactly-Once vs Effectively-Once
4. Sources of Duplicate Processing
5. Idempotency Architecture
6. Idempotency Keys
7. Idempotency Lifecycle
8. Client-Side Idempotency
9. Server-Side Idempotency
10. Worker Idempotency
11. Idempotency Storage
12. Failure Recovery
13. Performance Considerations
14. Future Evolution
15. Best Practices
16. Chapter Summary

---

# 20.1 Introduction

Distributed systems cannot guarantee that every message will be delivered and processed exactly once.

Networks fail.

Processes crash.

Connections reset.

Messages may be delivered multiple times.

Instead of attempting to eliminate duplicates, modern distributed systems are designed to **detect duplicates and safely ignore them**.

This approach is known as **idempotency**.

The Distributed Task Scheduler uses idempotency throughout the scheduling pipeline to achieve **effectively-once processing**.

---

# 20.2 Why Idempotency Matters

Failures may occur after a job has already been processed.

Example:

```text
Worker

↓

Execute Job

↓

Business Logic Completed

↓

ACK Lost

↓

RabbitMQ

↓

Redelivers Message
```

Without idempotency:

```text
Email Sent

↓

Message Redelivered

↓

Email Sent Again
```

Users receive duplicate emails.

With idempotency:

```text
Email Sent

↓

Duplicate Detected

↓

Ignore
```

Only one execution affects the business system.

---

# 20.3 Exactly-Once vs Effectively-Once

Exactly-once execution across distributed systems is generally impractical because independent systems cannot atomically coordinate message delivery, execution, acknowledgements, and persistent state under all failure conditions.

Instead, the scheduler provides **effectively-once execution**.

```text
RabbitMQ

↓

At-Least-Once Delivery

+

Idempotent Workers

↓

Effectively Once
```

This is the model used by most large-scale distributed systems.

### System Phase Guarantees Matrix

| System Phase            | Mechanism                                             | Real-World Guarantee                                                      |
| :---------------------- | :---------------------------------------------------- | :------------------------------------------------------------------------ |
| **Scheduler ➔ Scanner** | Redis Leader Election & Bucket Partitioning           | **Exactly-once** job creation per schedule interval                       |
| **Dispatcher Layer**    | PostgreSQL `FOR UPDATE SKIP LOCKED`                   | **Exactly-once** job claiming per batch across concurrent dispatchers     |
| **Messaging Layer**     | RabbitMQ Direct Exchanges & Durable Queues            | **At-least-once** message delivery                                        |
| **Worker Runtime**      | DB State (`SUCCEEDED`/`DEAD`) + Redis `RUNNING` Lease | **At-most-one** concurrent execution per job ID                           |
| **Business Operations** | Downstream Idempotency Keys (e.g. SMTP/Stripe header) | **Requires idempotent handlers** to avoid duplicate external side-effects |

---

# 20.4 Sources of Duplicate Processing

Duplicate execution may occur because of:

- Worker crashes
- Lost acknowledgements
- Network failures
- Client retries
- Dispatcher retries
- Scanner recovery
- RabbitMQ redelivery
- Process restarts

Every component must assume duplicates are possible.

---

# 20.5 Idempotency Architecture

```text
Client

↓

REST API

↓

Timer Service

↓

RabbitMQ

↓

Worker

↓

Idempotency Store

↓

Business Logic
```

Duplicate detection happens before business logic executes.

---

# 20.6 Idempotency Keys

Every logical operation receives a unique key.

Example:

```text
idem_9f82ab41
```

The key represents the operation rather than an individual request.

For example:

```text
Create Invoice #1452
```

should always use the same idempotency key until the operation completes successfully.

---

## Properties

A good idempotency key should be:

- Globally unique
- Immutable
- Random
- Difficult to predict
- Stable across retries

---

# 20.7 Idempotency Lifecycle

```text
Receive Request

↓

Lookup Key

↓

Exists?

├── Yes → Return Existing Result

└── No

↓

Reserve Key

↓

Execute

↓

Store Result

↓

Completed
```

The first successful execution becomes the canonical result.

Subsequent retries reuse it.

---

# 20.8 Client-Side Idempotency

Clients may generate their own idempotency keys.

Example request:

```http
POST /jobs

Idempotency-Key: 6d13d5b8-72ef-4b3c-a2c6-0d91baf72abc
```

Flow:

```text
Client

↓

Generate UUID

↓

Send Request

↓

Timeout

↓

Retry

↓

Same Key
```

The server recognizes the duplicate request and returns the original response instead of creating another job.

---

# 20.9 Server-Side Idempotency

Some operations are generated internally.

Examples:

- Retry jobs
- Recurring jobs
- Recovery jobs

The scheduler generates deterministic idempotency keys.

Example:

```text
scheduleId

+

executionTime

↓

Hash

↓

Idempotency Key
```

Every retry uses the same logical operation identifier.

---

# 20.10 Worker Idempotency

Workers always check the idempotency store before executing business logic.

```text
Receive Message

↓

Lookup Key

↓

Already Completed?

├── Yes

│

└── Return Success

↓

No

↓

Execute Handler

↓

Store Completion

↓

ACK
```

Business logic runs only once.

---

# 20.11 Idempotency & Side-Effect Storage

System idempotency relies on PostgreSQL as the single source of truth across all tiers:

1. **Dispatcher Claim Tier**: PostgreSQL `jobs` table updated via `UPDATE jobs SET status = 'DISPATCHED' ... WHERE id IN (SELECT id FROM jobs WHERE status = 'READY' FOR UPDATE SKIP LOCKED LIMIT 500) RETURNING *`.
2. **Worker Runtime Tier**: PostgreSQL `jobs` status (`SUCCEEDED`/`DEAD`) + `executions` audit log.
3. **Side-Effect Audit Tier**: `job_effects` table tracking downstream execution metadata.

Table: `job_effects`

| Field         | Type        | Purpose                                                                  |
| :------------ | :---------- | :----------------------------------------------------------------------- |
| `id`          | UUID        | Primary Key                                                              |
| `job_id`      | UUID        | Foreign Key to `jobs.id` (Indexed)                                       |
| `effect_type` | VARCHAR     | Operation type (`EMAIL`, `WEBHOOK`, `S3_UPLOAD`, `PAYMENT`)              |
| `external_id` | VARCHAR     | Downstream Provider ID (SendGrid Msg ID, Request UUID, Stripe Charge ID) |
| `status`      | VARCHAR     | Effect status (`SUCCESS`, `PENDING`, `FAILED`)                           |
| `metadata`    | JSONB       | Execution headers and response metadata                                  |
| `created_at`  | TIMESTAMPTZ | Creation timestamp                                                       |

---

# 20.12 Failure Recovery

## Worker Crash

```text
Reserve Key

↓

Worker Crashes

↓

Recovery

↓

Retry
```

If execution never completed, the operation resumes safely.

---

## Duplicate Delivery

```text
RabbitMQ

↓

Duplicate Message

↓

Existing Key

↓

Ignore
```

---

## Client Retry

```text
Request

↓

Timeout

↓

Retry

↓

Same Key

↓

Original Response
```

The client experiences a successful operation without creating duplicates.

---

## Partial Execution

If business logic commits but the completion record is not stored:

```text
Business Commit

↓

Failure

↓

Recovery Process

↓

Reconcile
```

Handlers interacting with external systems should also support idempotent operations whenever possible.

---

# 20.13 Performance Considerations

## Cache Hot Keys

Frequently accessed idempotency keys may be cached in Redis.

---

## Expiration

Old keys should eventually expire.

Example:

```text
Completed

↓

30 Days

↓

Delete
```

Retention depends on business requirements.

---

## Efficient Lookup

Index:

```text
(key)
```

This allows constant-time duplicate detection.

---

## Atomic Reservation

Creating a new idempotency record must be atomic.

```text
Lookup

+

Insert

↓

Single Transaction
```

This prevents multiple workers from reserving the same key simultaneously.

---

# 20.14 Future Evolution

### Phase 1

```text
PostgreSQL

Only
```

↓

### Phase 2

```text
PostgreSQL

+

Redis Cache
```

↓

### Phase 3

```text
Distributed

Idempotency Service
```

↓

### Phase 4

```text
Cross-Region

Replication
```

↓

### Phase 5

```text
Global

Deduplication
```

As the platform scales geographically, idempotency evolves without changing application behavior.

---

# 20.15 Idempotency Best Practices

The scheduler follows these principles:

- Assume duplicate delivery is always possible.
- Make every handler idempotent.
- Never depend on exactly-once delivery.
- Use immutable idempotency keys.
- Reserve keys atomically.
- Store successful execution results.
- Return cached responses for duplicate requests.
- Expire old keys according to retention policies.
- Cache frequently accessed keys.
- Monitor duplicate detection metrics.

---

# 20.16 Idempotency Metrics

| Metric                    | Purpose                        |
| ------------------------- | ------------------------------ |
| Duplicate Requests        | Client retries                 |
| Duplicate Messages        | RabbitMQ redelivery            |
| Cache Hit Rate            | Redis effectiveness            |
| Key Lookup Latency        | Store performance              |
| Reserved Keys             | Active operations              |
| Completed Keys            | Successful executions          |
| Expired Keys              | Cleanup activity               |
| Duplicate Prevention Rate | Effectiveness of deduplication |

These metrics help operators verify that duplicate processing is being prevented without introducing excessive overhead.

---

# Chapter Summary

This chapter designed the idempotency model for the Distributed Task Scheduler Platform. We explored why exactly-once execution is impractical in distributed systems, the concept of effectively-once processing, sources of duplicate delivery, client-side and server-side idempotency keys, worker-side duplicate detection, idempotency storage, failure recovery, performance considerations, and future evolution. By combining at-least-once message delivery with deterministic duplicate detection, the scheduler ensures that business operations remain safe, consistent, and resilient even when messages, requests, or failures occur multiple times.

---

# Next Chapter

**Chapter 21 — Retry System & Failure Recovery**

The next chapter focuses on the scheduler's retry architecture. It will explain retry policies, exponential backoff algorithms, retry queues, transient versus permanent failures, dead-letter queues, poison message handling, retry metadata, recovery workflows, and how the platform reliably processes failures without overwhelming downstream systems.

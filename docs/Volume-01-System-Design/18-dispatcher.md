# Chapter 18 — Dispatcher Service & Execution Dispatch Pipeline

**Document:** Distributed Task Scheduler Platform
**Chapter:** 18
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why a Dispatcher Service?
3. Responsibilities
4. Architecture
5. Dispatch Pipeline
6. Message Validation
7. Message Enrichment
8. Publishing to RabbitMQ
9. Publisher Confirmations
10. Idempotent Dispatch
11. Failure Handling
12. Performance Optimization
13. Horizontal Scaling
14. Future Evolution
15. Best Practices
16. Chapter Summary

---

# 18.1 Introduction

The **Dispatcher Service** is responsible for reliably transferring executable jobs from the Timing Plane into the Execution Plane.

After the Scanner identifies a job that is ready for execution, the Dispatcher prepares the execution message, validates it, enriches it with operational metadata, publishes it to RabbitMQ, and updates the job state only after successful delivery.

The Dispatcher separates **job discovery** from **message delivery**, making each service simpler and easier to scale independently.

---

# 18.2 Why a Dispatcher Service?

Although the Scanner can technically publish directly to RabbitMQ, separating dispatch into its own service provides several advantages:

- Clear separation of responsibilities
- Independent scaling
- Centralized message validation
- Consistent message format
- Easier observability
- Better retry handling
- Future support for multiple brokers

The Scanner determines **which jobs** should execute.

The Dispatcher determines **how those jobs enter the execution pipeline**.

---

# 18.3 Responsibilities

The Dispatcher Service is responsible for:

- Receiving promoted jobs
- Validating execution requests
- Enriching execution metadata
- Publishing to RabbitMQ
- Waiting for publisher confirmations
- Updating dispatch status
- Recording dispatch metrics
- Propagating tracing information

The Dispatcher is **not** responsible for:

- Finding due jobs
- Executing business logic
- Running workers
- Scheduling recurring jobs

---

# 18.4 Architecture

```text
                Scanner Service

                       │

             Promoted Job Event

                       │

              Dispatcher Service

        ┌──────────────┼──────────────┐

        │              │              │

   Validation     Enrichment     Tracing

                       │

                 RabbitMQ Exchange

                       │

                Execution Queue

                       │

                 Worker Service
```

The Dispatcher acts as the final checkpoint before execution.

---

# 18.5 Dispatch Pipeline

Every promoted job follows the same sequence.

```text
Receive Promotion

↓

Validate Job

↓

Enrich Metadata

↓

Publish Message

↓

Publisher Confirm

↓

Update Job Status

↓

Complete
```

Each step must succeed before the next begins.

---

# 18.6 Message Validation

Before publishing, the Dispatcher validates the execution request.

Validation includes:

- Job exists
- Job state is `READY`
- Handler is registered
- Payload is valid
- Retry information is consistent
- Required metadata exists

Invalid jobs are rejected before reaching RabbitMQ.

Example:

```text
Job

↓

Missing Handler

↓

Validation Failed

↓

Reject Dispatch
```

---

# 18.7 Message Enrichment

The Dispatcher adds operational metadata that workers require.

Example message:

```json
{
  "messageId": "msg_123",
  "jobId": "job_456",
  "tenantId": "tenant_001",
  "handler": "send-email",
  "payload": {},
  "priority": 5,
  "retryCount": 0,
  "traceId": "trace_001",
  "correlationId": "corr_789",
  "createdAt": "2027-01-01T12:00:00Z"
}
```

Enrichment ensures that every worker receives a consistent message regardless of how the job was originally created.

---

# 18.8 Publishing to RabbitMQ

Publishing follows a strict sequence.

```text
Dispatcher

↓

Exchange

↓

Execution Queue

↓

Worker
```

Messages are published as:

- Persistent
- Durable
- Immutable

The Dispatcher never modifies a message after publication.

---

# 18.9 Publisher Confirmations

Reliable delivery requires publisher confirmations.

Successful flow:

```text
Dispatcher

↓

Publish

↓

RabbitMQ

↓

ACK

↓

Update Database
```

Failed flow:

```text
Dispatcher

↓

Publish

↓

No Confirmation

↓

Retry
```

Database state changes only after RabbitMQ confirms successful receipt.

---

# 18.10 Idempotent Dispatch

Duplicate publication must never result in duplicate execution.

The Dispatcher achieves **exactly-once job claiming** across multiple concurrent Dispatcher instances via **PostgreSQL `FOR UPDATE SKIP LOCKED` atomic SQL queries**.

```sql
UPDATE jobs
SET status = 'DISPATCHED', last_heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT id FROM jobs
  WHERE (status = 'READY' AND execute_at <= CURRENT_TIMESTAMP)
     OR (status = 'DISPATCHED' AND (last_heartbeat IS NULL OR last_heartbeat <= CURRENT_TIMESTAMP - INTERVAL '15 seconds'))
  ORDER BY priority DESC, execute_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 500
)
RETURNING *;
```

PostgreSQL row-level locking guarantees that Node A and Node B will never claim or publish the same job row simultaneously. Stale dispatched jobs past visibility timeout are automatically re-claimed without memory bloat or race conditions.

Workers also verify idempotency before execution via DB status validation and downstream `Idempotency-Key` headers.

---

# 18.11 Failure Handling

## RabbitMQ Unavailable

```text
Publish

↓

Failed

↓

Retry Later
```

The job remains in the `READY` state.

---

## Dispatcher Crash

```text
Dispatcher

↓

Crash

↓

No Confirmation

↓

Scanner Reprocesses Job
```

No dispatch state is committed until publication succeeds.

---

## Database Update Failure

```text
Published

↓

Status Update Failed

↓

Recovery Process

↓

Reconcile State
```

Recovery jobs periodically compare dispatch records with RabbitMQ acknowledgements.

---

## Invalid Message

```text
Validation Failed

↓

Reject

↓

Audit Log

↓

Alert
```

Invalid jobs never enter the execution queue.

---

# 18.12 Performance Optimization

## Batch Publishing

Instead of:

```text
1 Publish

↓

1 Confirmation
```

Publish:

```text
500 Messages

↓

500 Confirmations
```

Batch publishing reduces network overhead.

---

## Asynchronous Confirmations

Publisher confirmations are processed asynchronously to maximize throughput.

---

## Connection Reuse

RabbitMQ connections remain open.

Channels are reused instead of recreated for every message.

---

## Parallel Dispatch

Multiple dispatcher instances may publish simultaneously.

Ordering is preserved per job through idempotency rather than global serialization.

---

# 18.13 Horizontal Scaling

Dispatcher instances are stateless.

```text
               Scanner

                   │

        ┌──────────┼──────────┐

        │          │          │

Dispatcher A  Dispatcher B  Dispatcher C

        │          │          │

        └──────────┼──────────┘

             RabbitMQ Exchange
```

Requests are distributed automatically.

No dispatcher owns specific jobs permanently.

---

# 18.14 Future Evolution

### Phase 1

```text
Single Dispatcher
```

↓

### Phase 2

```text
Multiple Dispatchers
```

↓

### Phase 3

```text
Priority-Based Dispatch
```

↓

### Phase 4

```text
Multiple Message Brokers

(RabbitMQ + Kafka)
```

↓

### Phase 5

```text
Adaptive Routing

Based On

Queue Health
```

The Dispatcher becomes the abstraction layer between scheduling and message transport.

---

# 18.15 Dispatcher Best Practices

The Dispatcher follows these principles:

- Validate every job before publishing.
- Never update dispatch state before publisher confirmation.
- Keep messages immutable.
- Generate globally unique message identifiers.
- Reuse RabbitMQ connections and channels.
- Batch publications whenever possible.
- Propagate correlation and trace identifiers.
- Treat every publish as retryable until confirmed.
- Keep dispatch logic stateless.
- Record dispatch metrics for every message.

---

# 18.16 Dispatcher Metrics

| Metric                   | Purpose                        |
| ------------------------ | ------------------------------ |
| Dispatch Rate            | Messages published per second  |
| Publish Latency          | Time to publish messages       |
| Publisher Confirm Time   | Broker acknowledgement latency |
| Failed Publications      | Publish reliability            |
| Retry Count              | Dispatch retries               |
| Validation Failures      | Invalid execution requests     |
| Queue Publish Throughput | Broker performance             |
| Dispatch Success Rate    | Overall reliability            |

These metrics help operators identify bottlenecks between the Timing Plane and the Execution Plane.

---

# Chapter Summary

This chapter designed the Dispatcher Service as the reliable message delivery component of the Distributed Task Scheduler Platform. We examined its responsibilities, dispatch pipeline, validation process, message enrichment, RabbitMQ publishing, publisher confirmations, idempotent dispatch, failure recovery, performance optimizations, horizontal scaling, and operational metrics. By separating message delivery from job discovery, the Dispatcher provides a robust abstraction that ensures every executable job is safely and consistently transferred into the Execution Plane while maintaining reliability, observability, and fault tolerance.

---

# Next Chapter

**Chapter 19 — Worker Service & Job Execution Engine**

The next chapter explores the Worker Service, the final stage of the execution pipeline. It will cover worker registration, job consumption, handler discovery, execution lifecycle, acknowledgements, timeout handling, retries, concurrency management, graceful shutdown, resource isolation, failure recovery, and how workers execute business logic safely and efficiently in a distributed environment.

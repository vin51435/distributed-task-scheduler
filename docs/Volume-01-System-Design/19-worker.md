# Chapter 19 — Worker Service & Job Execution Engine

**Document:** Distributed Task Scheduler Platform
**Chapter:** 19
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Worker Responsibilities
3. Design Goals
4. Worker Architecture
5. Worker Lifecycle
6. Job Consumption
7. Handler Discovery
8. Job Execution Pipeline
9. Acknowledgements
10. Timeout Management
11. Concurrency Control
12. Graceful Shutdown
13. Failure Recovery
14. Horizontal Scaling
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 19.1 Introduction

The **Worker Service** is the final stage of the Distributed Task Scheduler Platform.

After a job has been scheduled, promoted, dispatched, and delivered through RabbitMQ, the Worker is responsible for executing the actual business logic.

Examples include:

- Sending an email
- Sending an SMS
- Creating an invoice
- Calling an external API
- Generating a report
- Triggering a webhook

The Worker does **not** determine when a job executes.

It simply executes the work it receives.

---

# 19.2 Worker Responsibilities

The Worker Service is responsible for:

- Consuming messages from RabbitMQ
- Validating execution requests
- Discovering the correct handler
- Executing business logic
- Managing execution timeouts
- Reporting execution status
- Acknowledging completed messages
- Triggering retries when necessary

The Worker is **not** responsible for:

- Scheduling jobs
- Managing recurring schedules
- Scanning PostgreSQL
- Publishing jobs

---

# 19.3 Design Goals

The Worker is designed to achieve:

- Reliable execution
- Horizontal scalability
- Idempotent processing
- Fault tolerance
- Controlled concurrency
- Graceful shutdown
- Resource isolation
- Fast recovery

---

# 19.4 Worker Architecture

```text
            RabbitMQ

                │

        Execution Queue

                │

         Worker Service

      ┌─────────┼─────────┐

      │         │         │

 Validation  Handler   Metrics

                │

       Business Logic

                │

      External Systems
```

Workers consume jobs independently and execute business logic without interacting with the scheduling engine.

---

# 19.5 Worker Lifecycle

Every worker follows the same lifecycle.

```text
Start

↓

Connect RabbitMQ

↓

Register Handlers

↓

Consume Jobs

↓

Execute

↓

ACK/NACK

↓

Repeat
```

The worker continues consuming messages until shutdown.

---

# 19.6 Job Consumption

RabbitMQ delivers a message.

```text
RabbitMQ

↓

Worker

↓

Receive Message
```

The Worker immediately performs:

- Schema validation
- Handler lookup
- Idempotency verification

Only valid jobs continue to execution.

---

## Prefetch

Example:

```text
Prefetch = 20
```

The worker processes at most 20 unacknowledged jobs simultaneously.

This prevents one worker from becoming overloaded.

---

# 19.7 Handler Discovery

Every job specifies its handler.

Example:

```json
{
  "handler": "send-email"
}
```

Worker:

```text
Receive Job

↓

Lookup Handler

↓

Execute Handler
```

Example handler registry:

| Handler        | Purpose            |
| -------------- | ------------------ |
| send-email     | Email delivery     |
| send-sms       | SMS delivery       |
| create-invoice | Invoice generation |
| webhook        | HTTP callback      |

Unknown handlers are rejected immediately.

---

# 19.8 Job Execution Pipeline

Execution follows a strict sequence.

```text
Receive Message

↓

Validate

↓

Check Idempotency

↓

Load Handler

↓

Execute

↓

Record Result

↓

ACK
```

If execution fails:

```text
Execute

↓

Exception

↓

NACK

↓

Retry Queue
```

---

# 19.9 Acknowledgements

Workers acknowledge messages **only after successful execution**.

Correct flow:

```text
Receive

↓

Execute

↓

Success

↓

ACK
```

Incorrect flow:

```text
Receive

↓

ACK

↓

Execute

↓

Crash
```

This would permanently lose the job.

Therefore:

**ACK only after successful completion.**

---

## Negative Acknowledgement

Failure:

```text
Receive

↓

Execute

↓

Failure

↓

NACK
```

RabbitMQ routes the job to the retry mechanism.

---

# 19.10 Timeout Management

Business logic should never execute indefinitely.

Example:

```text
Execution Timeout

=

60 Seconds
```

Flow:

```text
Execute

↓

Timeout?

↓

Yes

↓

Terminate

↓

Retry
```

Timeouts protect the worker pool from blocked executions.

---

# 19.11 Concurrency Control

Workers process multiple jobs concurrently.

Example:

```text
Worker

├── Job A

├── Job B

├── Job C

└── Job D
```

Concurrency limits are configurable.

Example:

```text
Maximum Concurrent Jobs = 25
```

The appropriate value depends on:

- CPU
- Memory
- External APIs
- Handler complexity

---

# 19.12 Resource Isolation

Long-running handlers should not block unrelated work.

Possible strategies:

- Separate worker pools
- Dedicated queues
- Handler-specific concurrency limits

Example:

```text
Email Queue

↓

Email Workers
```

```text
Report Queue

↓

Report Workers
```

Heavy report generation does not delay email delivery.

---

# 19.13 Graceful Shutdown

Workers should never terminate while processing jobs.

Shutdown sequence:

```text
SIGTERM

↓

Stop Receiving Jobs

↓

Finish Active Jobs

↓

ACK Remaining

↓

Disconnect

↓

Shutdown
```

This prevents unnecessary retries.

---

# 19.14 Failure Recovery

## Worker Crash

```text
Worker

↓

Crash

↓

No ACK

↓

RabbitMQ

↓

Redelivery
```

---

## External API Failure

```text
HTTP Request

↓

503

↓

Retry
```

---

## Unknown Handler

```text
Lookup

↓

Failed

↓

Permanent Failure

↓

DLQ
```

---

## Database Failure

```text
Business Query

↓

Failed

↓

Retry
```

Transient infrastructure failures should be retried according to policy.

---

# 19.15 Horizontal Scaling

Workers scale independently.

```text
              RabbitMQ

                  │

      ┌───────────┼───────────┐

      │           │           │

 Worker A    Worker B    Worker C
```

RabbitMQ automatically balances work across available consumers.

Increasing the number of workers increases throughput without changing producers.

---

# 19.16 Observability

Each execution records:

- Start time
- End time
- Duration
- Handler name
- Retry count
- Result
- Trace ID
- Correlation ID

Metrics include:

| Metric         | Purpose          |
| -------------- | ---------------- |
| Jobs Executed  | Throughput       |
| Success Rate   | Reliability      |
| Failure Rate   | Errors           |
| Execution Time | Performance      |
| Timeout Count  | Slow handlers    |
| Retry Count    | Stability        |
| Active Jobs    | Current workload |
| Queue Lag      | Backlog          |

These metrics are exported through OpenTelemetry and Prometheus.

---

# 19.17 Future Evolution

### Phase 1

```text
Single Worker
```

↓

### Phase 2

```text
Multiple Workers
```

↓

### Phase 3

```text
Dedicated Worker Pools
```

↓

### Phase 4

```text
Priority-Based Workers
```

↓

### Phase 5

```text
Auto-Scaling Workers

Based On

Queue Depth
```

As workload grows, workers can scale horizontally and specialize by workload type without changing the execution model.

---

# 19.18 Worker Best Practices

The Worker follows these principles:

- Keep handlers stateless.
- ACK messages only after successful execution.
- Make every handler idempotent.
- Apply execution timeouts.
- Limit concurrency appropriately.
- Separate heavy and lightweight workloads.
- Record execution metrics.
- Propagate trace and correlation identifiers.
- Support graceful shutdown.
- Treat business failures differently from infrastructure failures.

---

# 19.19 Worker Execution Summary

| Stage     | Responsibility                |
| --------- | ----------------------------- |
| Consume   | Receive message from RabbitMQ |
| Validate  | Verify message structure      |
| Resolve   | Locate registered handler     |
| Execute   | Run business logic            |
| Record    | Capture execution result      |
| ACK/NACK  | Notify RabbitMQ               |
| Retry/DLQ | Handle failures               |

---

# Chapter Summary

This chapter designed the Worker Service as the execution engine of the Distributed Task Scheduler Platform. We examined job consumption, handler discovery, execution lifecycle, acknowledgements, timeout management, concurrency control, graceful shutdown, failure recovery, horizontal scaling, observability, and operational best practices. The Worker safely executes business logic while remaining stateless, horizontally scalable, fault tolerant, and fully integrated with RabbitMQ's acknowledgement and retry mechanisms.

---

# Next Chapter

**Chapter 20 — Idempotency & Exactly-Once Processing**

The next chapter explores one of the most critical concepts in distributed systems: idempotency. It will explain why exactly-once delivery is practically impossible in distributed environments, how the scheduler achieves effectively-once execution through idempotency keys, deduplication strategies, execution records, replay protection, client-generated versus server-generated idempotency keys, and recovery from duplicate deliveries across the entire scheduling pipeline.

# Chapter 10 — Internal Communication & Messaging Patterns

**Document:** Distributed Task Scheduler Platform
**Chapter:** 10
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Communication Philosophy
3. Communication Types
4. Synchronous Communication
5. Asynchronous Communication
6. Communication Flow
7. Commands vs Events
8. RabbitMQ Message Design
9. Queue Architecture
10. Message Lifecycle
11. Delivery Guarantees
12. Acknowledgements
13. Retries
14. Dead Letter Queues
15. Correlation IDs & Trace Propagation
16. Communication Best Practices
17. Future Evolution
18. Chapter Summary

---

# 10.1 Introduction

A distributed system consists of multiple independent services.

For the scheduler to function correctly, these services must communicate reliably, efficiently, and predictably.

The platform uses two primary communication models:

- **Synchronous communication** using **gRPC**
- **Asynchronous communication** using **RabbitMQ**

Choosing the correct communication pattern is essential for achieving scalability, reliability, and fault tolerance.

---

# 10.2 Communication Philosophy

The scheduler follows these principles:

### 1. Use synchronous communication for immediate responses.

Example:

```text
API

↓

Timer Service

↓

Job Created
```

The caller must wait for the response.

---

### 2. Use asynchronous communication for background work.

Example

```text
Scanner

↓

RabbitMQ

↓

Worker
```

The sender continues immediately after publishing the message.

---

### 3. Keep services loosely coupled.

A service should know **what** another service can do, but not **how** it does it.

---

### 4. Never share databases.

Communication must happen through:

- gRPC
- RabbitMQ

Never through direct SQL queries.

---

# 10.3 Communication Types

| Type             | Technology | Example        |
| ---------------- | ---------- | -------------- |
| Request/Response | gRPC       | Create Job     |
| Event            | RabbitMQ   | Job Ready      |
| Health Check     | HTTP/gRPC  | Service Status |
| Metrics          | Prometheus | Queue Depth    |

---

# 10.4 Synchronous Communication

Synchronous communication is used when the caller requires an immediate response.

Example:

```text
Client

↓

REST API

↓

gRPC

↓

Timer Service

↓

Response

↓

REST Response
```

Characteristics:

- Immediate response
- Caller waits
- Strong consistency
- Simple request flow

Examples:

- Create Job
- Get Job
- Update Job
- Cancel Job
- Acquire Lease

---

## Advantages

- Easy to understand
- Predictable
- Strong request-response semantics

---

## Disadvantages

- Higher coupling
- Caller blocked until completion
- Cascading failures are possible

---

# 10.5 Asynchronous Communication

Asynchronous communication decouples producers from consumers.

Example

```text
Scanner

↓

RabbitMQ

↓

Worker

↓

Notification
```

The Scanner does not know:

- which worker receives the message
- when execution begins
- how long execution takes

It only knows that the message was successfully published.

---

## Advantages

- Loose coupling
- Better scalability
- Natural buffering
- Improved fault tolerance

---

## Disadvantages

- More complex debugging
- Eventual consistency
- Retry management required

---

# 10.6 Complete Communication Flow

Creating and executing a delayed job:

```text
Client

↓

REST API

↓

gRPC

↓

Timer Service

↓

PostgreSQL

↓

Scanner

↓

RabbitMQ

↓

Worker

↓

Notification Service

↓

SMTP

↓

Audit Service
```

Notice that synchronous and asynchronous communication are combined within a single workflow.

---

# 10.7 Commands vs Events

Not every message has the same meaning.

The scheduler distinguishes between **commands** and **events**.

---

## Commands

A command tells another component to perform an action.

Examples:

```text
CreateJob

CancelJob

AcquireLease

SendNotification
```

Characteristics:

- One sender
- One intended receiver
- Represents an instruction

---

## Events

Events describe something that has already happened.

Examples

```text
JobCreated

JobReady

JobStarted

JobSucceeded

JobFailed

LeaseExpired
```

Characteristics:

- Fact
- Immutable
- Multiple consumers possible

---

## Difference

| Command              | Event              |
| -------------------- | ------------------ |
| "Do this."           | "This happened."   |
| Intent               | Notification       |
| Usually one consumer | Multiple consumers |

---

# 10.8 RabbitMQ Message Design

Messages should contain only the information required for execution.

Example

```json
{
  "messageId": "msg_001",
  "jobId": "job_123",
  "tenantId": "tenant_1",
  "handler": "send-email",
  "payload": {
    "email": "user@example.com"
  },
  "retryCount": 0,
  "traceId": "trace_xyz",
  "createdAt": "2027-01-01T09:00:00Z"
}
```

Avoid embedding unnecessary data that can be retrieved later if needed.

---

# 10.9 Queue Architecture

The scheduler uses dedicated queues for different purposes.

```text
                RabbitMQ

                    │

        ┌───────────┼────────────┐

        │           │            │

Execution    Retry Queue      DLQ

Queue
```

---

## Execution Queue

Receives ready-to-run jobs.

Consumed by Worker Services.

---

## Retry Queue

Stores jobs that should be retried later.

---

## Dead Letter Queue (DLQ)

Stores jobs that permanently failed.

These jobs require investigation or manual intervention.

---

# 10.10 Message Lifecycle

The lifecycle of a message:

```text
Timer Store

↓

Scanner

↓

RabbitMQ

↓

Execution Queue

↓

Worker

↓

ACK

↓

Message Removed
```

If execution fails:

```text
Worker

↓

Retry Queue

↓

Execution Queue

↓

Worker
```

If retries are exhausted:

```text
Worker

↓

Dead Letter Queue
```

---

# 10.11 Delivery Guarantees

RabbitMQ provides **at-least-once delivery**.

This means:

- A message will be delivered.
- It may be delivered more than once.

Example

```text
Worker crashes

↓

RabbitMQ

↓

Redelivers message
```

Workers must therefore be **idempotent**.

Exactly-once delivery is achieved through application-level idempotency rather than relying on the broker.

---

# 10.12 Acknowledgements

Workers explicitly acknowledge successful processing.

Flow:

```text
Receive Message

↓

Execute Job

↓

Success

↓

ACK
```

If the worker crashes before sending the acknowledgement:

```text
Receive

↓

Worker Crash

↓

No ACK

↓

RabbitMQ Redelivery
```

This prevents message loss.

---

# 10.13 Retries

Transient failures should be retried automatically.

Example retry policy:

| Attempt | Delay      |
| ------- | ---------- |
| 1       | Immediate  |
| 2       | 5 seconds  |
| 3       | 30 seconds |
| 4       | 2 minutes  |
| 5       | 10 minutes |

Exponential backoff prevents overwhelming downstream systems.

Permanent failures should not be retried.

---

# 10.14 Dead Letter Queues

Some jobs cannot succeed.

Examples:

- Invalid payload
- Unsupported handler
- Corrupted message
- Retry limit exceeded

Instead of deleting them:

```text
Worker

↓

Dead Letter Queue
```

Operators can later inspect:

- payload
- error message
- retry history
- timestamps

---

# 10.15 Correlation IDs & Trace Propagation

Every request receives a unique **Correlation ID**.

Example

```text
Correlation ID

↓

REST

↓

gRPC

↓

RabbitMQ

↓

Worker

↓

Notification
```

Every log entry contains:

- correlationId
- traceId
- spanId
- jobId

This allows engineers to trace a request across the entire distributed system.

---

# 10.16 Failure Scenarios

## gRPC Failure

```text
API

↓

Timer Service unavailable

↓

Retry

↓

Return Error
```

---

## RabbitMQ Failure

```text
Scanner

↓

Cannot Publish

↓

Retry Publish

↓

Alert
```

Jobs remain safely stored in PostgreSQL until publishing succeeds.

---

## Worker Crash

```text
Worker

↓

No ACK

↓

RabbitMQ Redelivery
```

---

## Notification Failure

```text
Worker

↓

Retry

↓

DLQ
```

The scheduler remains operational even when downstream business services fail.

---

# 10.17 Communication Best Practices

The platform follows these guidelines:

- Use gRPC only for synchronous operations.
- Use RabbitMQ only for asynchronous operations.
- Keep messages immutable.
- Keep messages small.
- Include correlation and trace identifiers.
- Never expose internal database models.
- Design consumers to be idempotent.
- Handle duplicate message delivery safely.
- Acknowledge messages only after successful processing.
- Use DLQs instead of silently discarding failures.

---

# 10.18 Future Evolution

As the scheduler grows, communication patterns can evolve.

### Phase 1

```text
REST

↓

gRPC

↓

RabbitMQ
```

---

### Phase 2

Add:

- Multiple RabbitMQ exchanges
- Topic routing
- Priority queues

---

### Phase 3

Introduce:

- Event bus
- Domain events
- Event replay

---

### Phase 4

Potentially integrate:

- Kafka for analytics and event streaming
- CQRS for read/write separation

RabbitMQ remains the execution broker, while Kafka (if introduced) would complement it for large-scale event streaming rather than replace it.

---

# 10.19 Communication Matrix

| Source     | Destination  | Method | Purpose                 |
| ---------- | ------------ | ------ | ----------------------- |
| Client     | API          | REST   | Public interface        |
| API        | Timer        | gRPC   | Create and manage jobs  |
| Timer      | PostgreSQL   | SQL    | Persist scheduling data |
| Scanner    | Coordinator  | gRPC   | Acquire leases          |
| Scanner    | RabbitMQ     | AMQP   | Publish ready jobs      |
| Worker     | RabbitMQ     | AMQP   | Consume jobs            |
| Worker     | Timer        | gRPC   | Update job status       |
| Worker     | Audit        | gRPC   | Record execution        |
| Worker     | Notification | gRPC   | Execute business action |
| Prometheus | Services     | HTTP   | Collect metrics         |

---

# Chapter Summary

This chapter described how services communicate within the Distributed Task Scheduler Platform. We examined synchronous gRPC communication, asynchronous RabbitMQ messaging, command and event patterns, queue architecture, message lifecycle, acknowledgements, retries, dead-letter queues, delivery guarantees, correlation IDs, and trace propagation. Together, these communication patterns connect the Timing Plane and Execution Plane while ensuring that the platform remains scalable, resilient, and loosely coupled.

---

# Next Chapter

**Chapter 11 — PostgreSQL Data Model & Timer Store Design**

The next chapter begins the storage layer. It will design the Timer Store in PostgreSQL, including schema design, table relationships, indexes, partitioning strategies, state transitions, query optimization, transactional behavior, concurrency control, and how the database supports millions of scheduled jobs efficiently.

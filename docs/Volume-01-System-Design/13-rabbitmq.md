# Chapter 13 — RabbitMQ Design & Message Broker Architecture

**Document:** Distributed Task Scheduler Platform
**Chapter:** 13
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why RabbitMQ?
3. RabbitMQ Responsibilities
4. RabbitMQ Architecture
5. Core Concepts
6. Exchanges
7. Queues
8. Routing Keys & Bindings
9. Message Structure
10. Message Lifecycle
11. Publisher Confirms
12. Consumer Acknowledgements
13. Retry Architecture
14. Dead Letter Queues
15. Flow Control & Backpressure
16. Scaling Consumers
17. Monitoring
18. Future Evolution
19. Chapter Summary

---

# 13.1 Introduction

RabbitMQ forms the **Execution Plane** of the scheduler.

Its responsibility is **not deciding when a job should execute**.

Instead, RabbitMQ executes the work **after** the Timer Service and Scanner determine that a job is ready.

The separation of responsibilities is fundamental:

- PostgreSQL decides **when**
- RabbitMQ delivers **what**
- Workers execute **how**

---

# 13.2 Why RabbitMQ?

A scheduler requires reliable background execution.

Requirements include:

- Reliable delivery
- Message acknowledgements
- Retry support
- Dead Letter Queues
- Routing
- Multiple consumers
- High throughput

RabbitMQ satisfies these requirements while remaining relatively simple to operate.

---

## Advantages

- Mature
- Reliable
- Easy routing
- Consumer acknowledgements
- Publisher confirms
- Dead-letter exchanges
- Priority queues
- Message TTL

---

## Disadvantages

- Not designed for long-term event storage
- Lower throughput than Kafka
- Messages should remain relatively small

---

# 13.3 RabbitMQ Responsibilities

RabbitMQ is responsible for:

- Receiving executable jobs
- Delivering jobs to workers
- Handling acknowledgements
- Redelivering failed messages
- Managing retries
- Routing failed jobs to DLQs

RabbitMQ is **not responsible** for:

- Scheduling jobs
- Storing execution history
- Tracking recurring schedules

Those responsibilities remain with PostgreSQL.

---

# 13.4 RabbitMQ Architecture

```text
                 PostgreSQL

                      │

                 Scanner Service

                      │

                Publish Message

                      │

                RabbitMQ Exchange

                      │

          ┌───────────┼───────────┐

          │                       │

 Execution Queue           Retry Queue

          │                       │

          └───────────┬───────────┘

                      │

                 Worker Service

                      │

              Business Handler
```

---

# 13.5 Core Concepts

RabbitMQ consists of several building blocks.

| Component       | Purpose                        |
| --------------- | ------------------------------ |
| Producer        | Publishes messages             |
| Exchange        | Routes messages                |
| Queue           | Stores messages                |
| Binding         | Connects exchanges and queues  |
| Consumer        | Processes messages             |
| Acknowledgement | Confirms successful processing |

---

# 13.6 Exchanges

Producers never publish directly to queues.

Instead:

```text
Producer

↓

Exchange

↓

Queue
```

The exchange determines where messages should go.

---

## Exchange Types

### Direct

Routes by exact routing key.

```text
execution

↓

execution.queue
```

---

### Topic

Supports wildcard routing.

Example:

```text
job.email

job.sms

job.notification
```

---

### Fanout

Broadcasts messages to all bound queues.

Useful for:

- cache invalidation
- monitoring
- notifications

---

### Headers

Routes using message headers.

Rarely needed for this scheduler.

---

## Selected Exchange

The scheduler primarily uses a **Direct Exchange**.

Reason:

Jobs have a clear destination.

---

# 13.7 Queues

The scheduler defines multiple queues.

```text
execution.queue

retry.queue

dead-letter.queue
```

---

## Execution Queue

Stores executable jobs.

Consumers:

Worker Services

---

## Retry Queue

Temporarily stores failed jobs before another attempt.

---

## Dead Letter Queue

Stores permanently failed jobs.

Operators inspect these messages later.

---

# 13.8 Routing Keys & Bindings

Example:

```text
Exchange

↓

Routing Key

execution

↓

execution.queue
```

Binding:

```text
execution.exchange

↓

execution

↓

execution.queue
```

This provides flexibility if additional worker types are introduced later.

---

# 13.9 Message Structure

Messages contain execution metadata.

Example

```json
{
  "messageId": "msg_123",
  "jobId": "job_456",
  "tenantId": "tenant_1",
  "handler": "send-email",
  "payload": {},
  "retryCount": 0,
  "priority": 5,
  "traceId": "trace_001",
  "createdAt": "2027-01-01T12:00:00Z"
}
```

Messages should remain compact.

Large payloads should be stored externally.

---

# 13.10 Message Lifecycle

A successful execution:

```text
Timer Store

↓

Scanner

↓

Exchange

↓

Execution Queue

↓

Worker

↓

Execute

↓

ACK

↓

Removed
```

---

Failure:

```text
Worker

↓

Retry Queue

↓

Execution Queue

↓

Worker
```

---

Permanent failure:

```text
Worker

↓

Dead Letter Queue
```

---

# 13.11 Publisher Confirms

Publishing must be reliable.

Without confirms:

```text
Scanner

↓

Publish

↓

Network Failure

↓

Message Lost
```

Publisher confirms solve this problem.

Flow:

```text
Scanner

↓

Publish

↓

RabbitMQ

↓

Confirm

↓

Scanner Marks Success
```

If confirmation is not received:

Publish again.

---

# 13.12 Consumer Acknowledgements

Workers acknowledge messages only after successful execution.

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

The message would be lost.

Therefore:

**ACK only after successful processing.**

---

# 13.13 Retry Architecture

Some failures are temporary.

Example:

SMTP unavailable.

Retry flow:

```text
Execution Queue

↓

Worker

↓

Failure

↓

Retry Queue

↓

Delay

↓

Execution Queue
```

Retry policy example:

| Attempt | Delay     |
| ------- | --------- |
| 1       | Immediate |
| 2       | 5 sec     |
| 3       | 30 sec    |
| 4       | 2 min     |
| 5       | 10 min    |

After the maximum retry count:

↓

DLQ

---

# 13.14 Dead Letter Queues

Messages arrive in the DLQ when:

- Retry limit exceeded
- Invalid payload
- Unsupported handler
- Permanent business failure

DLQ message:

```text
Original Message

+

Retry History

+

Failure Reason
```

Operators may:

- replay
- inspect
- delete

---

# 13.15 Flow Control & Backpressure

Suppose:

```text
100,000

Messages

↓

10

Workers
```

Workers cannot process everything immediately.

RabbitMQ buffers messages.

Consumers pull work at their own speed.

---

## Prefetch Count

RabbitMQ limits the number of unacknowledged messages.

Example:

```text
Prefetch = 20
```

Worker:

Receives

20

Processes

ACK

Receives

20 more

This prevents one worker from monopolizing the queue.

---

# 13.16 Scaling Consumers

Scaling is straightforward.

```text
Execution Queue

        │

 ┌──────┼──────┐

 │      │      │

Worker Worker Worker
```

RabbitMQ automatically distributes messages among available workers.

Adding more workers increases throughput without modifying producers.

---

# 13.17 Monitoring

Important RabbitMQ metrics include:

| Metric           | Purpose                      |
| ---------------- | ---------------------------- |
| Queue Depth      | Pending work                 |
| Publish Rate     | Incoming jobs                |
| Consume Rate     | Worker throughput            |
| Ack Rate         | Successful processing        |
| Retry Count      | Failure trend                |
| DLQ Size         | Permanent failures           |
| Consumer Count   | Active workers               |
| Unacked Messages | Workers currently processing |

These metrics are collected by Prometheus and visualized in Grafana.

---

# 13.18 Failure Scenarios

## Worker Crash

```text
Worker

↓

No ACK

↓

RabbitMQ

↓

Redelivery
```

---

## RabbitMQ Restart

```text
RabbitMQ

↓

Restart

↓

Persistent Queues

↓

Messages Restored
```

Durable queues and persistent messages prevent data loss.

---

## Scanner Crash

```text
Publish Not Confirmed

↓

Retry Publish

↓

No Duplicate

(using message idempotency)
```

---

## Queue Overflow

```text
Consumers Slow

↓

Queue Grows

↓

Autoscale Workers
```

Monitoring queue depth allows proactive scaling.

---

# 13.19 Future Evolution

### Phase 1

```text
Single RabbitMQ Node

↓

Execution Queue
```

---

### Phase 2

```text
Multiple Workers

↓

Execution Queue
```

---

### Phase 3

```text
Priority Queues

↓

Topic Exchanges

↓

Multiple Execution Queues
```

---

### Phase 4

```text
RabbitMQ Cluster

↓

High Availability
```

---

### Phase 5

```text
Separate Event Bus

↓

Kafka

(for analytics & event streaming)
```

RabbitMQ continues handling execution tasks, while Kafka—if introduced—would handle high-volume event streaming and analytics.

---

# 13.20 RabbitMQ Best Practices

The scheduler follows these principles:

- Use durable queues.
- Publish persistent messages.
- Require publisher confirms.
- ACK only after successful execution.
- Retry only transient failures.
- Send permanent failures to the DLQ.
- Keep messages immutable.
- Keep payloads small.
- Use correlation and trace IDs.
- Monitor queue depth continuously.
- Scale consumers horizontally instead of increasing worker complexity.

---

# 13.21 Queue Summary

| Queue               | Producer | Consumer  | Purpose            |
| ------------------- | -------- | --------- | ------------------ |
| `execution.queue`   | Scanner  | Worker    | Execute ready jobs |
| `retry.queue`       | Worker   | Worker    | Delayed retry      |
| `dead-letter.queue` | Worker   | Operators | Failed jobs        |

---

# Chapter Summary

This chapter designed RabbitMQ as the execution backbone of the Distributed Task Scheduler Platform. We explored exchanges, queues, bindings, routing keys, message structure, publisher confirms, consumer acknowledgements, retries, dead-letter queues, flow control, consumer scaling, monitoring, and failure handling. RabbitMQ provides reliable asynchronous message delivery, allowing the Timing Plane to hand off executable jobs to the Execution Plane while ensuring resilience, scalability, and fault tolerance.

---

# Next Chapter

**Chapter 14 — Object Storage Design (MinIO)**

The next chapter covers the platform's object storage layer. It will explain why object storage is needed, how MinIO integrates with the scheduler, bucket organization, backup storage, exported reports, archived audit logs, large payload handling, lifecycle policies, versioning, encryption, access control, and the migration path from local MinIO to cloud object storage such as Amazon S3, Google Cloud Storage, or Azure Blob Storage.

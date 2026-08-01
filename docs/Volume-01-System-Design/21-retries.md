# Chapter 21 — Retry System & Failure Recovery

**Document:** Distributed Task Scheduler Platform
**Chapter:** 21
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Retries Are Necessary
3. Retry Philosophy
4. Failure Classification
5. Retry Architecture
6. Retry Lifecycle
7. Retry Policies
8. Backoff Algorithms
9. Retry Queue
10. Dead Letter Queue (DLQ)
11. Poison Message Handling
12. Retry Metadata
13. Failure Recovery
14. Performance Optimization
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 21.1 Introduction

Failures are inevitable in distributed systems.

A worker may fail because:

- A database is temporarily unavailable.
- A network request times out.
- A third-party API returns an error.
- A service is restarting.
- Infrastructure becomes temporarily overloaded.

Most failures are **temporary**, not permanent.

The Retry System enables jobs to recover automatically without manual intervention while preventing endless execution loops.

---

# 21.2 Why Retries Are Necessary

Consider an email service.

```text
Worker

↓

Call Email API

↓

503 Service Unavailable
```

Immediately marking the job as failed would lose work.

Instead:

```text
Failure

↓

Retry Later

↓

Email API Recovers

↓

Success
```

Retries significantly improve overall system reliability.

---

# 21.3 Retry Philosophy

Not every failure should be retried.

The scheduler follows these principles:

- Retry transient failures.
- Fail permanent errors immediately.
- Apply increasing delays.
- Limit maximum attempts.
- Prevent retry storms.
- Preserve execution history.

Retries are a recovery mechanism, not a substitute for fixing application bugs.

---

# 21.4 Failure Classification

Failures are divided into two categories.

## Transient Failures

Temporary problems.

Examples:

- Network timeout
- HTTP 503
- Database connection failure
- RabbitMQ unavailable
- DNS resolution issue

These failures are retryable.

---

## Permanent Failures

Errors that retries cannot fix.

Examples:

- Invalid payload
- Unknown handler
- Authentication failure
- Validation error
- Missing required resource

These jobs should move directly to the Dead Letter Queue.

---

# 21.5 Retry Architecture

```text
            Worker

               │

         Execution Failed

               │

      Retry Decision Engine

        ┌────────┴────────┐

        │                 │

 Retry Allowed?      Permanent Failure

        │                 │

      Retry Queue        DLQ

        │

    Scanner Later

        │

    RabbitMQ Again

        │

      Worker
```

The Retry System separates temporary failures from unrecoverable failures.

---

# 21.6 Retry Lifecycle

```text
Execute

↓

Failure

↓

Retry Policy

↓

Calculate Delay

↓

Update execute_at

↓

WAITING

↓

Scanner

↓

Dispatch

↓

Execute Again
```

Every retry becomes a normal scheduled job with a new execution time.

---

# 21.7 Retry Policies

Each job defines:

| Field           | Purpose           |
| --------------- | ----------------- |
| maxAttempts     | Maximum retries   |
| retryCount      | Current attempt   |
| initialDelay    | First retry delay |
| maxDelay        | Upper delay limit |
| backoffStrategy | Delay algorithm   |

Example:

```text
Maximum Attempts = 5
```

Retry sequence:

```text
Attempt 1

↓

Attempt 2

↓

Attempt 3

↓

Attempt 4

↓

Attempt 5

↓

DLQ
```

---

# 21.8 Backoff Algorithms

## Fixed Delay

```text
30s

30s

30s

30s
```

Simple but may overload recovering systems.

---

## Linear Backoff

```text
30s

60s

90s

120s
```

Delay increases gradually.

---

## Exponential Backoff

```text
30s

60s

120s

240s

480s
```

This is the recommended strategy.

---

## Exponential Backoff with Jitter

```text
30s

58s

137s

255s

489s
```

Random variation prevents thousands of jobs from retrying simultaneously.

This is the preferred production strategy.

---

# 21.9 Retry Queue

Failed jobs are temporarily routed to the retry workflow.

```text
Worker

↓

Failure

↓

Retry Metadata

↓

Update execute_at

↓

WAITING

↓

Scanner

↓

RabbitMQ
```

Unlike traditional RabbitMQ delay queues, this scheduler stores retry timing inside PostgreSQL.

The Scanner promotes retries when their new execution time arrives.

---

# 21.10 Dead Letter Queue (DLQ)

Jobs exceeding retry limits move to the Dead Letter Queue.

```text
Retry 5

↓

Failure

↓

DLQ
```

DLQ jobs require investigation.

Typical reasons:

- Invalid payload
- Software bug
- Permanent dependency failure
- Unsupported handler

DLQ messages are never automatically retried.

---

# 21.11 Poison Message Handling

A poison message fails every execution attempt.

Example:

```text
Receive

↓

Execute

↓

Crash

↓

Retry

↓

Crash

↓

Retry

↓

Crash
```

Eventually:

```text
Maximum Attempts

↓

DLQ
```

This prevents infinite retry loops.

---

# 21.12 Retry Metadata

Each retry stores execution history.

| Field        | Purpose                |
| ------------ | ---------------------- |
| retryCount   | Current attempt        |
| lastFailure  | Failure timestamp      |
| errorCode    | Failure classification |
| errorMessage | Failure reason         |
| nextRetry    | Scheduled retry        |
| workerId     | Last executing worker  |

Execution history provides valuable debugging information.

---

# 21.13 Failure Recovery

## Worker Crash

```text
Worker

↓

Crash

↓

RabbitMQ Redelivery

↓

Retry Policy
```

---

## Database Failure

```text
Retry Update

↓

Failed

↓

Rollback

↓

Retry Transaction
```

---

## RabbitMQ Failure

```text
Publish Retry

↓

RabbitMQ Down

↓

WAITING

↓

Retry Later
```

The Timer Store remains the source of truth.

---

## Infrastructure Recovery

```text
Service Offline

↓

Recover

↓

Retry Executes

↓

Success
```

Most transient failures resolve automatically.

---

# 21.14 Performance Optimization

## Batch Retry Updates

Instead of updating one job:

```text
1 UPDATE
```

Update many:

```text
500 UPDATEs

↓

Single Batch
```

---

## Indexed Queries

Retry jobs use the same index:

```sql
(status, execute_at)
```

No additional scanning logic is required.

---

## Retry Limits

Maximum retry count prevents excessive resource consumption.

---

## Jitter

Randomized retry timing prevents synchronized traffic spikes.

---

# 21.15 Future Evolution

### Phase 1

```text
Fixed Retry Delay
```

↓

### Phase 2

```text
Exponential Backoff
```

↓

### Phase 3

```text
Jitter
```

↓

### Phase 4

```text
Adaptive Retry Policies
```

↓

### Phase 5

```text
Machine Learning

Failure Prediction
```

Future versions may dynamically adjust retry behavior based on historical success rates.

---

# 21.16 Retry Best Practices

The Retry System follows these principles:

- Retry only transient failures.
- Never retry validation errors.
- Use exponential backoff with jitter.
- Limit retry attempts.
- Preserve complete retry history.
- Keep retry timing in PostgreSQL.
- Route unrecoverable jobs to the DLQ.
- Avoid retry storms.
- Monitor retry success rates.
- Treat retries as new scheduled executions.

---

# 21.17 Retry Metrics

| Metric                 | Purpose                |
| ---------------------- | ---------------------- |
| Retry Count            | Number of retries      |
| Retry Success Rate     | Recovery effectiveness |
| Average Retry Delay    | Backoff performance    |
| DLQ Count              | Permanent failures     |
| Poison Messages        | Repeated failures      |
| Retry Latency          | Recovery speed         |
| Retry Queue Size       | Outstanding retries    |
| Failure Classification | Error distribution     |

These metrics help determine whether failures are temporary infrastructure issues or application defects.

---

# Chapter Summary

This chapter designed the Retry System for the Distributed Task Scheduler Platform. We examined failure classification, retry architecture, retry lifecycle, retry policies, backoff algorithms, retry metadata, dead-letter queues, poison message handling, failure recovery, performance optimizations, and operational metrics. By treating retries as newly scheduled executions managed by the Timer Store, the scheduler provides reliable recovery from transient failures while protecting the platform from endless retry loops and ensuring that permanent failures are isolated for investigation.

---

# Next Chapter

**Chapter 22 — Distributed Coordination & Leader Election**

The next chapter explores how multiple scheduler instances safely cooperate in a distributed environment. It will cover distributed locks, leases, leader election, bucket ownership, heartbeats, failure detection, split-brain prevention, Redis-based coordination, migration to etcd, and how coordination enables Scanner, Cron, and other services to scale horizontally without processing the same work more than once.

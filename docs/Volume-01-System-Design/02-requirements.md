# Chapter 2 — Requirements Engineering

**Document:** Distributed Task Scheduler Platform
**Chapter:** 2
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Stakeholders
3. System Scope
4. Functional Requirements
5. Non-Functional Requirements
6. System Constraints
7. Assumptions
8. Service Level Objectives (SLOs)
9. Acceptance Criteria
10. User Stories
11. Success Metrics
12. Future Requirements
13. Chapter Summary

---

# 2.1 Introduction

Before designing the architecture, we must define **what the system is expected to do**.

This chapter defines the complete set of functional and non-functional requirements for the Distributed Task Scheduler Platform.

These requirements become the contract between the system's design and its implementation.

Every future design decision must satisfy the requirements documented here.

---

# 2.2 Problem Statement

Modern applications frequently need to execute work in the future.

Examples include:

- Send an email tomorrow
- Retry a failed payment after 10 minutes
- Generate monthly invoices
- Notify users about subscription expiration
- Retry failed webhooks
- Schedule reports
- Archive inactive accounts

Embedding scheduling logic directly inside business services creates several problems:

- duplicated logic
- poor scalability
- unreliable retries
- complex deployment
- tight coupling

Instead, scheduling should become a dedicated platform.

---

# 2.3 Stakeholders

Several systems interact with the scheduler.

## Application Developers

Need a simple API to schedule jobs.

Example:

```http
POST /jobs
```

---

## Business Services

Need jobs delivered reliably.

Examples:

- Notification Service
- Billing Service
- Webhook Service
- CRM Service

---

## Operations Team

Needs:

- monitoring
- metrics
- dashboards
- alerts
- logs

---

## Platform Engineers

Need:

- scalability
- reliability
- fault tolerance
- observability

---

# 2.4 System Scope

The scheduler is responsible for **time-based orchestration**, not business logic.

Responsibilities include:

- accepting jobs
- storing jobs
- scheduling jobs
- retrying jobs
- promoting due jobs
- executing jobs through workers
- auditing execution
- exposing metrics

Responsibilities outside the scheduler include:

- sending emails
- charging credit cards
- generating invoices
- sending SMS
- business validation
- authentication logic

---

# 2.5 Functional Requirements

## FR-1 Job Creation

The system shall allow clients to create a new job.

Input:

- execution time
- handler
- payload
- tenant
- retry policy

Output:

- job ID
- status
- timestamps

---

## FR-2 Immediate Execution

The system shall support immediate execution.

Example

```text
Run now
```

Flow

```text
API

↓

RabbitMQ

↓

Worker
```

---

## FR-3 Delayed Execution

The system shall support delayed execution.

Example

```text
Run after 30 minutes
```

Flow

```text
API

↓

Timer Store

↓

Scanner

↓

RabbitMQ

↓

Worker
```

---

## FR-4 One-Time Scheduling

Users shall schedule a job for a specific date and time.

Example

```text
2027-01-10 10:30 UTC
```

---

## FR-5 Recurring Scheduling

Support recurring schedules.

Examples

```text
Daily

Weekly

Monthly

Yearly
```

---

## FR-6 Cron Expressions

Support standard cron syntax.

Examples

```cron
0 * * * *

0 9 * * 1

*/15 * * * *
```

---

## FR-7 Job Cancellation

A waiting job may be cancelled.

Cancelled jobs must never execute.

---

## FR-8 Job Rescheduling

Waiting jobs may be updated.

Example

```text
Tomorrow

↓

Next Week
```

---

## FR-9 Retry

Failed jobs shall retry automatically.

Retry policies:

- fixed delay
- linear
- exponential
- exponential + jitter

---

## FR-10 Dead Letter Queue

After retry exhaustion

↓

Move to DLQ

---

## FR-11 Idempotency

The system shall tolerate duplicate delivery.

Business operations must execute only once.

---

## FR-12 Audit

Store:

- execution history
- latency
- retries
- worker
- result

---

## FR-13 Job Query

Clients may retrieve:

- status
- history
- execution attempts
- retry count

---

## FR-14 Pause Schedule

Recurring schedules may be paused.

---

## FR-15 Resume Schedule

Paused schedules may resume.

---

## FR-16 Delete Schedule

Recurring schedules may be permanently deleted.

---

## FR-17 Multi-Tenant Support

Multiple customers share one scheduler.

Example

```text
Tenant A

Tenant B

Tenant C
```

Each tenant must remain isolated.

---

## FR-18 Priority

Jobs may define priorities.

Example

```text
HIGH

NORMAL

LOW
```

---

## FR-19 Rate Limiting

Limit execution rate.

Example

```text
100 emails/minute
```

---

## FR-20 Timezones

Schedules shall support user-defined timezones.

---

# 2.6 Non-Functional Requirements

---

## Availability

Target

```text
99.99%
```

---

## Durability

A scheduled job must never disappear because of:

- restart
- crash
- deployment

---

## Reliability

Every accepted job should eventually execute unless cancelled.

---

## Horizontal Scalability

Multiple instances of:

- API
- Scanner
- Worker

must operate simultaneously.

---

## Fault Tolerance

The scheduler shall continue functioning after:

- worker crash
- scanner crash
- pod restart

---

## Performance

API response

Target

```text
<200 ms
```

---

Job promotion

Target

```text
<5 sec
```

---

Worker startup

```text
<1 sec
```

---

## Observability

Everything must expose:

- metrics
- logs
- traces

---

## Security

Support:

- JWT
- TLS
- mTLS (future)
- tenant isolation

---

## Maintainability

Every service should remain independently deployable.

---

## Extensibility

Future components should integrate without redesign.

Examples

- Cassandra
- Kafka
- etcd

---

# 2.7 System Constraints

The first version intentionally limits complexity.

Initial database

```text
PostgreSQL
```

instead of Cassandra.

---

Coordinator

```text
Redis
```

instead of etcd.

---

Queue

```text
RabbitMQ
```

instead of Kafka.

---

Deployment

```text
Docker Compose
```

instead of Kubernetes.

---

Language

```text
TypeScript
```

Framework

```text
NestJS
```

---

# 2.8 Assumptions

The design assumes:

- clock synchronization between nodes
- PostgreSQL persistence
- Redis persistence for leases
- RabbitMQ durability
- workers are stateless
- services communicate over a trusted network

---

# 2.9 Service Level Objectives (SLOs)

## Job Acceptance

99.99%

---

## Job Storage

100%

No accepted job should be lost.

---

## Scheduling Accuracy

Target

```text
±5 seconds
```

under normal load.

---

## Retry Accuracy

Retries should execute according to configured policy.

---

## Worker Availability

Workers should recover automatically after crashes.

---

# 2.10 Acceptance Criteria

The scheduler is considered complete when it can:

✅ Create jobs

✅ Schedule future jobs

✅ Execute recurring jobs

✅ Retry failed jobs

✅ Maintain idempotency

✅ Cancel jobs

✅ Reschedule jobs

✅ Support multiple workers

✅ Support multiple scanners

✅ Recover after service failures

✅ Expose metrics

✅ Produce distributed traces

---

# 2.11 User Stories

## Story 1

As an application,

I want to schedule a future email

so users receive reminders automatically.

---

## Story 2

As a payment service,

I want failed payments retried automatically

so temporary failures recover.

---

## Story 3

As a platform engineer,

I want multiple workers

so execution scales horizontally.

---

## Story 4

As an administrator,

I want dashboards

so I can monitor scheduler health.

---

## Story 5

As a developer,

I want gRPC communication

so services communicate efficiently.

---

# 2.12 Success Metrics

The project is successful if it demonstrates:

### Reliability

No job loss.

---

### Scalability

Multiple workers increase throughput.

---

### Fault Tolerance

System survives crashes.

---

### Observability

Every request traceable.

---

### Developer Experience

Easy API.

Easy deployment.

Clear documentation.

---

# 2.13 Future Requirements

Version 2

- Cassandra Timer Store
- etcd Coordinator
- Kafka Event Streaming
- Multi-region deployment
- Geo-replication
- Disaster recovery
- Event sourcing
- CQRS
- Automatic scaling

---

# 2.14 Requirement Traceability Matrix

| Requirement    | Component Responsible       |
| -------------- | --------------------------- |
| Job Creation   | API Service + Timer Service |
| Delayed Jobs   | Timer Service               |
| Recurring Jobs | Cron Service                |
| Promotion      | Scanner Service             |
| Execution      | Worker Service              |
| Retry          | Worker + Timer Service      |
| DLQ            | RabbitMQ                    |
| Audit          | Audit Service               |
| Metrics        | Prometheus                  |
| Tracing        | OpenTelemetry               |
| Logs           | Loki                        |
| Coordination   | Redis (later etcd)          |

---

# 2.15 Chapter Summary

This chapter translated the project vision into concrete requirements. We identified the scheduler's stakeholders, defined its functional capabilities (such as delayed execution, recurring schedules, retries, idempotency, and multi-tenancy), established non-functional goals like availability, durability, scalability, and observability, documented system constraints and assumptions, and introduced measurable service-level objectives and acceptance criteria. These requirements form the baseline against which every architectural and implementation decision will be evaluated.

---

## Next Chapter

**Chapter 3 — Distributed Systems Fundamentals**

Before designing the scheduler's architecture, the next chapter will build the theoretical foundation required to understand distributed systems. It will cover concepts such as distributed computing, CAP theorem, consistency models, replication, partitioning, consensus, leader election, coordination, horizontal scaling, failure detection, and the principles that influence the design of reliable distributed infrastructure.

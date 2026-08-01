# Chapter 5 — Service Architecture & Responsibilities

**Document:** Distributed Task Scheduler Platform
**Chapter:** 5
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Service-Oriented Architecture
3. Service Boundaries
4. Complete Service Map
5. API Service
6. Timer Service
7. Scanner Service
8. Worker Service
9. Cron Service
10. Coordinator Service
11. Notification Service
12. Audit Service
13. Shared Library
14. Inter-Service Communication
15. Service Startup Order
16. Health Checks
17. Service Dependencies
18. Service Scaling Strategy
19. Failure Scenarios
20. Folder Structure
21. Chapter Summary

---

# 5.1 Introduction

In the previous chapter, we examined the scheduler from a system-wide perspective.

This chapter zooms into each microservice and defines:

- Why the service exists
- What it owns
- What it is allowed to do
- What it is **not** allowed to do
- How it communicates
- How it scales
- What data it owns

These boundaries are extremely important because poor service boundaries are one of the biggest causes of complexity in distributed systems.

---

# 5.2 Service-Oriented Architecture

The scheduler is composed of independent services.

```text
                 Client
                    │
            REST API Service
                    │
              gRPC Requests
                    │
     ┌──────────────┼───────────────┐
     │              │               │
 Timer Service   Cron Service   Coordinator
     │                              │
 PostgreSQL                     Redis
     │
 Scanner Service
     │
 RabbitMQ
     │
 Worker Service
     │
 Business Services
```

Each service has:

- one responsibility
- independent deployment
- independent scaling
- independent monitoring

---

# 5.3 Service Boundaries

Every service follows the same rule.

> **A service owns its business domain.**

Only the owner may modify its data.

Example:

Timer Service owns scheduled jobs.

Worker Service must **never** directly update timer tables.

Instead:

```text
Worker

↓

gRPC

↓

Timer Service

↓

PostgreSQL
```

This prevents accidental coupling.

---

# 5.4 Complete Service Map

| Service              | Primary Responsibility   | Persistent Storage             |
| -------------------- | ------------------------ | ------------------------------ |
| API Service          | Public REST API          | None                           |
| Timer Service        | Job storage              | PostgreSQL                     |
| Scanner Service      | Promote due jobs         | None                           |
| Worker Service       | Execute jobs             | None                           |
| Cron Service         | Generate recurring jobs  | PostgreSQL (via Timer Service) |
| Coordinator Service  | Distributed coordination | Redis                          |
| Notification Service | Send notifications       | Own database (optional)        |
| Audit Service        | Execution history        | PostgreSQL                     |
| Shared Library       | Common code              | None                           |

---

# 5.5 API Service

## Purpose

The API Service is the entry point into the scheduler.

Clients never communicate directly with internal services.

---

## Responsibilities

- REST endpoints
- Authentication
- Authorization
- Request validation
- Rate limiting
- OpenAPI (Swagger)
- Trace generation
- Request logging
- Calling internal gRPC services

---

## It Owns

Nothing.

The API Service is completely stateless.

---

## It Does NOT

- Store jobs
- Execute jobs
- Scan timers
- Retry jobs
- Access RabbitMQ directly

---

## Incoming Communication

REST

```http
POST /jobs

GET /jobs/:id

DELETE /jobs/:id

PATCH /jobs/:id
```

---

## Outgoing Communication

gRPC

↓

Timer Service

---

## Scaling

```text
REST API

Replica 1

Replica 2

Replica 3
```

Scale independently behind a Load Balancer.

---

# 5.6 Timer Service

## Purpose

The Timer Service owns scheduled jobs.

It is the heart of the scheduler.

---

## Responsibilities

- Create jobs
- Update jobs
- Delete jobs
- Cancel jobs
- Store timers
- Schedule retries
- Store recurring schedules
- Calculate buckets
- Maintain job states

---

## Owns

PostgreSQL

Tables:

```text
jobs

schedules

retry_history

job_state

audit_reference
```

---

## Does NOT

- Execute jobs
- Consume RabbitMQ
- Send notifications

---

## Incoming Communication

gRPC

↓

API Service

↓

Worker Service

↓

Cron Service

---

## Outgoing Communication

PostgreSQL

---

## Scaling

Usually fewer instances than workers.

Example

```text
Timer Service

Replica 1

Replica 2
```

---

# 5.7 Scanner Service

## Purpose

Convert waiting jobs into executable jobs.

---

## Responsibilities

- Scan Timer Store
- Acquire bucket leases
- Detect due jobs
- Publish to RabbitMQ
- Advance checkpoints

---

## Owns

No database.

Scanner is stateless.

---

## Reads

PostgreSQL

Redis

---

## Writes

RabbitMQ

Redis

---

## Communication

```text
PostgreSQL

↓

Scanner

↓

RabbitMQ
```

---

## Scaling

Many scanner replicas.

Each scanner owns different buckets.

```text
Scanner A

Bucket 1

Bucket 2

↓

Scanner B

Bucket 3

Bucket 4
```

---

# 5.8 Worker Service

## Purpose

Execute jobs.

---

## Responsibilities

- Consume RabbitMQ
- Execute handlers
- Retry failures
- DLQ
- Update audit
- Update job status

---

## Owns

Nothing.

Stateless.

---

## Incoming

RabbitMQ

---

## Outgoing

Notification Service

↓

Timer Service

↓

Audit Service

---

## Scaling

Largest service.

Example

```text
Worker

Replica 1

Replica 2

...

Replica 100
```

Workers scale based on queue depth.

---

# 5.9 Cron Service

## Purpose

Generate one-time jobs from recurring schedules.

Recurring jobs are **never** executed directly.

Instead:

```text
Cron Schedule

↓

Generate

↓

One-Time Job

↓

Timer Store
```

---

## Responsibilities

- Parse cron
- Calculate next execution
- Timezone conversion
- DST handling
- Misfire policy

---

## Owns

Nothing.

Uses Timer Service.

---

# 5.10 Coordinator Service

## Purpose

Coordinate distributed components.

---

## Responsibilities

- Distributed locks
- Leader election
- Bucket ownership
- Lease renewal
- Heartbeats

---

## Version 1

Redis

---

## Version 2

etcd

---

## Owns

Redis Keys

Example

```text
lease:bucket:10

scanner:leader

heartbeat:worker
```

---

# 5.11 Notification Service

This is an example business service.

The scheduler should never know SMTP.

Instead:

```text
Worker

↓

Notification Service

↓

SMTP
```

Responsibilities

- Email
- SMS
- Push
- Webhooks

Can be replaced without changing the scheduler.

---

# 5.12 Audit Service

Purpose

Maintain execution history.

Stores

- execution time
- latency
- retries
- errors
- worker ID

This service enables dashboards and reporting.

---

# 5.13 Shared Library

Every microservice uses shared code.

```text
shared/

├── proto/
├── logger/
├── config/
├── constants/
├── dto/
├── exceptions/
├── utils/
├── tracing/
├── metrics/
└── validation/
```

Avoid duplicating common logic.

---

# 5.14 Inter-Service Communication

The scheduler uses two communication styles.

## REST

External only.

```text
Client

↓

REST API
```

---

## gRPC

Internal synchronous communication.

```text
API

↓

Timer

↓

Coordinator
```

---

## RabbitMQ

Internal asynchronous communication.

```text
Scanner

↓

RabbitMQ

↓

Worker
```

Each communication method has a specific purpose.

---

# 5.15 Service Startup Order

During local development, services should start in dependency order.

```text
PostgreSQL

↓

Redis

↓

RabbitMQ

↓

Coordinator

↓

Timer Service

↓

Scanner

↓

Worker

↓

API

↓

Cron

↓

Notification
```

This minimizes connection failures during startup.

---

# 5.16 Health Checks

Every service exposes a health endpoint.

Example

```http
GET /health
```

Checks include:

API Service

- HTTP server

Timer Service

- PostgreSQL connection

Scanner

- PostgreSQL
- Redis
- RabbitMQ

Worker

- RabbitMQ

Coordinator

- Redis

Notification

- SMTP

Health checks are used by Docker Compose and Kubernetes to determine if a service is ready to receive traffic.

---

# 5.17 Service Dependencies

| Service      | Depends On                                 |
| ------------ | ------------------------------------------ |
| API          | Timer Service                              |
| Timer        | PostgreSQL                                 |
| Scanner      | PostgreSQL, Redis, RabbitMQ                |
| Worker       | RabbitMQ, Timer Service, Business Services |
| Cron         | Timer Service                              |
| Coordinator  | Redis                                      |
| Notification | SMTP Provider                              |
| Audit        | PostgreSQL                                 |

Dependencies should always point "downward." Business services should not depend on infrastructure services in reverse.

---

# 5.18 Service Scaling Strategy

Each service scales independently according to its workload.

| Service      | Scaling Trigger               |
| ------------ | ----------------------------- |
| API          | HTTP requests                 |
| Timer        | Job creation/update rate      |
| Scanner      | Waiting job count             |
| Worker       | RabbitMQ queue depth          |
| Cron         | Number of recurring schedules |
| Coordinator  | Usually fixed (1–3 replicas)  |
| Notification | Outbound notification rate    |
| Audit        | Write throughput              |

This prevents over-provisioning components that do not require additional capacity.

---

# 5.19 Failure Scenarios

## API Failure

Clients retry requests through the load balancer.

---

## Timer Service Failure

New jobs cannot be created.

Existing queued jobs continue executing.

---

## Scanner Failure

Lease expires.

Another scanner acquires the bucket and continues promotion.

---

## RabbitMQ Failure

Workers pause.

Jobs remain safely stored in PostgreSQL.

Once RabbitMQ recovers, scanners resume publishing.

---

## Worker Failure

RabbitMQ redelivers unacknowledged messages to another worker.

---

## Notification Failure

Worker retries according to the configured retry policy.

---

# 5.20 Recommended Repository Structure

```text
distributed-task-scheduler/

├── api-service/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── timer-service/
│
├── scanner-service/
│
├── worker-service/
│
├── cron-service/
│
├── coordinator-service/
│
├── notification-service/
│
├── audit-service/
│
├── shared/
│   ├── proto/
│   ├── common/
│   ├── logger/
│   ├── metrics/
│   ├── tracing/
│   ├── config/
│   └── dto/
│
├── docker/
├── kubernetes/
├── scripts/
└── docs/
```

This structure separates deployable services from shared libraries and infrastructure configuration, making the repository easy to navigate and extend.

---

# 5.21 Key Design Decisions

| Decision                                     | Justification                            |
| -------------------------------------------- | ---------------------------------------- |
| Stateless API                                | Easy horizontal scaling                  |
| Timer Service owns all scheduling data       | Single source of truth                   |
| Scanner does not execute jobs                | Clear separation of timing and execution |
| Worker does not modify database directly     | Maintains service ownership              |
| RabbitMQ separates scheduling from execution | Loose coupling and buffering             |
| Shared library for common code               | Reduces duplication                      |
| Independent deployments                      | Faster releases and fault isolation      |

---

# Chapter Summary

This chapter defined the detailed responsibilities and boundaries of every microservice in the Distributed Task Scheduler Platform. We identified what each service owns, how services communicate, what storage they are responsible for, how they scale independently, and how failures are isolated. These service boundaries form the architectural contract for the implementation and ensure that each component has a single, well-defined responsibility.

---

# Next Chapter

**Chapter 6 — Infrastructure Architecture**

The next chapter moves below the application layer and describes the infrastructure required to run the platform. It will cover Docker, Docker Compose, networking, PostgreSQL, RabbitMQ, Redis, MinIO, Prometheus, Grafana, Loki, Jaeger, environment variables, volumes, secrets, and how these components are connected locally and later deployed on Kubernetes.

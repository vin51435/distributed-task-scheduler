# Chapter 4 — High-Level Architecture

**Document:** Distributed Task Scheduler Platform
**Chapter:** 4
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Architectural Philosophy
3. Why Microservices?
4. High-Level System Architecture
5. Timing Plane
6. Execution Plane
7. Complete Request Lifecycle
8. Core Services
9. Service Responsibilities
10. Data Flow
11. Communication Patterns
12. Data Ownership
13. Scalability Strategy
14. Failure Isolation
15. Deployment Overview
16. Architecture Decisions
17. Future Evolution
18. Chapter Summary

---

# 4.1 Introduction

With the requirements established and the distributed systems concepts understood, we can now design the overall architecture of the scheduler.

This chapter presents the **High-Level Design (HLD)** of the platform. It defines the major services, their responsibilities, how they communicate, and how data flows through the system.

The objective of this architecture is to achieve:

- High reliability
- Horizontal scalability
- Fault tolerance
- Clear service boundaries
- Independent deployment
- Easy maintainability

Rather than focusing on implementation details, this chapter explains **what components exist** and **why they exist**.

---

# 4.2 Architectural Philosophy

The scheduler follows several architectural principles.

## Principle 1 — Single Responsibility

Each service should own one domain.

For example:

- API Service accepts requests.
- Timer Service stores jobs.
- Scanner Service promotes jobs.
- Worker Service executes jobs.

A service should never take over another service's responsibility.

---

## Principle 2 — Loose Coupling

Services should communicate only through well-defined interfaces.

Internal communication uses **gRPC**.

Asynchronous execution uses **RabbitMQ**.

No service should directly access another service's database.

---

## Principle 3 — Independent Scaling

Each service scales based on its workload.

Example:

```text
API Service        × 3

Timer Service      × 2

Scanner Service    × 5

Worker Service     × 50
```

Adding more workers should not require adding more API servers.

---

## Principle 4 — Stateless Services

Application services should remain stateless whenever possible.

State belongs in durable storage such as PostgreSQL or Redis.

This allows services to be restarted or replaced without losing information.

---

# 4.3 Why Microservices?

A scheduler can be implemented as a monolith.

However, a distributed scheduler benefits from separating responsibilities.

Instead of:

```text
One Application

├── API
├── Scheduler
├── Worker
├── Cron
└── Database
```

We divide the platform into multiple services.

```text
API

↓

Timer

↓

Scanner

↓

RabbitMQ

↓

Worker

↓

Business Service
```

Advantages include:

- independent deployment
- fault isolation
- better scalability
- easier maintenance
- simpler ownership

---

# 4.4 High-Level System Architecture

```text
                        Clients
                           │
                     REST API Service
                           │
                      gRPC Requests
                           │
                  ┌──────────────────┐
                  │  Timer Service   │
                  └──────────────────┘
                           │
                     PostgreSQL
                           │
                Scanner Services
                           │
                      RabbitMQ
                           │
                   Worker Services
                           │
                  Business Services
                           │
                  Notification / Billing
```

Supporting infrastructure:

```text
Redis
│
├── Distributed Leases
├── Rate Limits
├── Cache
└── Coordination

Prometheus
Grafana
Loki
Jaeger
MinIO
```

---

# 4.5 Timing Plane

The scheduler is divided into two logical planes.

The first is the **Timing Plane**.

Its only responsibility is determining **when** jobs become executable.

Components:

```text
Client

↓

API Service

↓

Timer Service

↓

PostgreSQL

↓

Scanner Service

↓

RabbitMQ
```

Responsibilities:

- receive jobs
- calculate execution time
- store jobs
- monitor time
- promote ready jobs

The Timing Plane never executes business logic.

---

# 4.6 Execution Plane

The second logical plane executes work.

```text
RabbitMQ

↓

Worker Service

↓

Notification Service

↓

SMTP
```

Responsibilities:

- consume jobs
- execute handlers
- retry failures
- acknowledge completion
- write audit logs

Workers never decide _when_ jobs should execute.

They only execute jobs that are already ready.

---

# 4.7 Complete Request Lifecycle

The lifecycle of a delayed job looks like this.

## Step 1

Client submits job.

```http
POST /jobs
```

↓

---

## Step 2

API validates request.

↓

---

## Step 3

API calls Timer Service over gRPC.

↓

---

## Step 4

Timer Service stores job in PostgreSQL.

Status:

```text
READY
```

↓

---

## Step 5

Scanner periodically scans waiting jobs.

↓

---

## Step 6

Scanner discovers that execution time has arrived.

↓

---

## Step 7

Scanner publishes job to RabbitMQ.

Status:

```text
READY
```

↓

---

## Step 8

Worker consumes job.

Status:

```text
RUNNING
```

↓

---

## Step 9

Worker executes business service.

↓

---

## Step 10

Worker updates audit.

↓

---

## Step 11

Worker acknowledges RabbitMQ.

Status:

```text
SUCCESS
```

Lifecycle complete.

---

# 4.8 Core Services

The system consists of several independent services.

## API Service

Purpose:

Entry point.

Responsibilities:

- REST endpoints
- authentication
- validation
- rate limiting
- request tracing

Owns:

Nothing.

Stateless.

---

## Timer Service

Purpose:

Owns all scheduled jobs.

Responsibilities:

- create jobs
- update jobs
- cancel jobs
- retry scheduling
- persistence

Owns:

PostgreSQL tables.

---

## Scanner Service

Purpose:

Convert waiting jobs into executable jobs.

Responsibilities:

- scan buckets
- acquire leases
- publish ready jobs

Owns:

Nothing.

Stateless.

---

## Worker Service

Purpose:

Execute business logic.

Responsibilities:

- consume RabbitMQ
- execute handlers
- retry failures
- audit

---

## Cron Service

Purpose:

Generate recurring jobs.

Responsibilities:

- parse cron expressions
- calculate next execution
- create one-time jobs

---

## Coordinator Service

Purpose:

Distributed coordination.

Responsibilities:

- leases
- heartbeats
- leadership
- bucket ownership

Version 1:

Redis

Version 2:

etcd

---

## Notification Service

Purpose:

Business logic.

Responsibilities:

- email
- SMS
- push notification

The scheduler does not know SMTP.

Only the Notification Service does.

---

# 4.9 Service Responsibility Matrix

| Service      | Responsibility            |
| ------------ | ------------------------- |
| API          | External REST interface   |
| Timer        | Job storage               |
| Scanner      | Detect due jobs           |
| RabbitMQ     | Transport executable jobs |
| Worker       | Execute jobs              |
| Cron         | Generate recurring jobs   |
| Coordinator  | Distributed ownership     |
| Notification | Business logic            |
| Audit        | Execution history         |

---

# 4.10 Communication Patterns

The architecture uses two communication styles.

## Synchronous

REST

Client

↓

API

---

gRPC

API

↓

Timer

↓

Coordinator

↓

Notification

---

## Asynchronous

RabbitMQ

```text
Scanner

↓

RabbitMQ

↓

Worker
```

Synchronous communication is used for commands and queries.

Asynchronous communication is used for long-running execution.

---

# 4.11 Data Ownership

Each service owns its own data.

| Service      | Owns                 |
| ------------ | -------------------- |
| Timer        | Scheduled Jobs       |
| Audit        | Execution History    |
| Notification | Notification Records |
| Coordinator  | Leases               |
| Worker       | No persistent state  |

No service should modify another service's tables directly.

---

# 4.12 Scalability Strategy

Different services scale independently.

Example:

```text
REST API

3 replicas

↓

Timer

2 replicas

↓

Scanner

5 replicas

↓

RabbitMQ

↓

Workers

100 replicas
```

Scaling workers increases execution throughput.

Scaling scanners increases promotion throughput.

Scaling API improves request handling.

---

# 4.13 Failure Isolation

Failures remain isolated.

Example:

Worker crashes.

Effect:

```text
Worker

↓

RabbitMQ

↓

Message redelivered
```

API continues working.

---

Scanner crashes.

Another scanner acquires the lease.

Promotion continues.

---

Notification Service crashes.

Workers retry.

Timer Service unaffected.

---

PostgreSQL temporarily unavailable.

API rejects scheduling requests.

Existing workers continue processing already promoted jobs.

---

# 4.14 Deployment Overview

Local development:

```text
Docker Compose

↓

All Services
```

Production:

```text
Kubernetes

↓

Pods

↓

Services

↓

Ingress

↓

Load Balancer
```

Each service has:

- separate deployment
- separate Docker image
- independent scaling

---

# 4.15 Architecture Decisions

| Decision           | Reason                          |
| ------------------ | ------------------------------- |
| REST externally    | Easy for clients                |
| gRPC internally    | Efficient service communication |
| RabbitMQ           | Reliable asynchronous execution |
| PostgreSQL         | Durable timer storage           |
| Redis              | Fast coordination               |
| Separate Scanner   | Decouple timing from execution  |
| Separate Workers   | Independent scaling             |
| Stateless services | Easier deployment and recovery  |

---

# 4.16 Future Evolution

The architecture is designed to evolve.

### Phase 1

```text
Single Scanner

Single Worker
```

↓

### Phase 2

```text
Multiple Scanners

Multiple Workers
```

↓

### Phase 3

```text
Redis Leases
```

↓

### Phase 4

```text
Kubernetes
```

↓

### Phase 5

```text
etcd
```

↓

### Phase 6

```text
Cassandra Timer Store
```

↓

### Phase 7

```text
Multi-region Deployment
```

The service boundaries remain unchanged throughout these phases, allowing the platform to evolve without redesigning the architecture.

---

# 4.17 Chapter Summary

This chapter defined the high-level architecture of the Distributed Task Scheduler Platform. We established the separation between the **Timing Plane**, which determines _when_ work should execute, and the **Execution Plane**, which performs the work. We introduced each core microservice, defined its responsibilities and ownership boundaries, described synchronous (REST/gRPC) and asynchronous (RabbitMQ) communication patterns, explained data ownership, scalability, and failure isolation, and outlined how the architecture will evolve from a local Docker Compose deployment to a Kubernetes-based, highly available distributed system.

---

# Next Chapter

**Chapter 5 — Service Architecture & Responsibilities**

The next chapter will examine each microservice individually. For every service, we will define:

- Internal NestJS module structure
- Folder organization
- Controllers
- Services
- Repositories
- gRPC clients and servers
- Configuration
- Environment variables
- Dockerfile
- Startup sequence
- Health checks
- Logging
- Metrics
- Dependency graph

This chapter will transition from the system-wide view into the detailed design of each individual service, forming the foundation for implementation.

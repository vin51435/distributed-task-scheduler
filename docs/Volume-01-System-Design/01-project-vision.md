# Chapter 1 — Project Vision, Introduction & System Overview

**Document:** Distributed Task Scheduler Platform
**Version:** 1.0
**Status:** Draft
**Author:** Project Design Specification

---

# Table of Contents

1. Introduction
2. Purpose of the Project
3. Background
4. The Problem
5. Why Existing Solutions Are Not Enough
6. Project Vision
7. Project Goals
8. Non-Goals
9. Learning Objectives
10. Real-World Use Cases
11. System Scope
12. High-Level Architecture
13. Core Concepts
14. Technology Stack
15. Local Development Environment
16. Development Philosophy
17. Long-Term Roadmap
18. Success Criteria
19. Chapter Summary

---

# 1. Introduction

## 1.1 What is this project?

The **Distributed Task Scheduler Platform** is a production-grade scheduling system designed to reliably execute tasks at specific times in the future. It is inspired by modern distributed scheduling systems such as:

* AWS EventBridge Scheduler
* Google Cloud Tasks
* Temporal
* Uber Cadence
* Netflix Conductor

Unlike a simple cron job or a background worker, this scheduler is intended to operate as an independent infrastructure service that other applications can depend upon.

Applications should never need to worry about **how** jobs are stored, **when** they are executed, **how** retries happen, or **how** failures are handled. They simply ask the scheduler to execute a task, and the scheduler guarantees reliable execution according to the requested schedule.

---

## 1.2 Purpose of this Document

This document serves as the **single source of truth** for the project.

It describes:

* system requirements
* architecture
* infrastructure
* service boundaries
* APIs
* databases
* distributed algorithms
* deployment
* development roadmap

It should be detailed enough that another engineer—or another AI—can build the system using this document alone.

---

# 2. Purpose of the Project

The goal is **not** merely to build another backend application.

The goal is to understand and implement the engineering concepts behind distributed infrastructure software.

Most web applications teach:

* CRUD operations
* authentication
* REST APIs
* database queries

Very few teach:

* distributed scheduling
* reliable message delivery
* leader election
* distributed coordination
* retries
* idempotency
* fault tolerance
* observability
* microservice communication

This project fills that gap.

---

# 3. Background

Almost every large software company runs scheduled work.

Examples include:

| Company | Scheduled Work         |
| ------- | ---------------------- |
| Amazon  | Order reminders        |
| Netflix | Subscription billing   |
| Google  | Calendar notifications |
| Stripe  | Payment retries        |
| Uber    | Trip receipts          |
| Slack   | Scheduled messages     |
| GitHub  | Actions & workflows    |

Behind each of these features is a scheduler responsible for determining **when** a task should execute.

The scheduler is not responsible for sending emails or processing payments. Instead, it orchestrates when those actions occur.

---

# 4. The Problem

Imagine a user signs up for a service.

The application needs to:

* send a welcome email immediately
* remind the user after 7 days
* expire the trial after 14 days
* bill the customer every month
* retry failed payments
* archive inactive accounts after one year

A normal queue cannot efficiently hold messages for days or months.

A cron job cannot manage millions of independent schedules.

Business applications should not contain complex timing logic.

Therefore, a dedicated scheduling platform is required.

---

# 5. Queue vs Scheduler

This distinction is fundamental.

## Queue

A queue answers one question:

> "What work should execute now?"

Example:

```text
API

↓

RabbitMQ

↓

Worker

↓

Send Email
```

Queues are excellent for immediate execution.

---

## Scheduler

A scheduler answers a different question:

> "What work should execute in the future?"

Example:

```text
Today

↓

Store job

↓

Wait

↓

Tomorrow

↓

Move to Queue

↓

Worker Executes
```

The scheduler manages time.

The queue manages execution.

This separation is one of the core architectural principles of this project.

---

# 6. Project Vision

The scheduler should become a reusable infrastructure platform.

Applications should interact with it through a simple API.

Example:

```http
POST /jobs
```

```json
{
  "runAt": "2027-01-10T09:00:00Z",
  "handler": "send_email",
  "payload": {
    "userId": 25
  }
}
```

The application immediately receives:

```json
{
  "jobId": "job_12345"
}
```

From that point onward, the scheduler owns the lifecycle of the job.

The application does not need to keep timers running or poll the database.

---

# 7. Project Goals

The system must support:

## Immediate Jobs

Execute immediately.

Example:

```text
Generate invoice
```

---

## Delayed Jobs

Execute after a delay.

Example:

```text
Retry payment after 15 minutes
```

---

## One-Time Jobs

Execute once at a specific date and time.

Example:

```text
Tomorrow 10:00 AM
```

---

## Recurring Jobs

Execute repeatedly.

Examples:

```text
Every Monday

Every Month

Every Day

Every Hour
```

---

## Cron Scheduling

Support standard cron expressions.

Example:

```text
0 9 * * *
```

---

## Retry Mechanism

Support configurable retry policies.

Examples:

* exponential backoff
* fixed delay
* linear retry
* jitter

---

## Dead Letter Queue

Failed jobs should eventually move to a DLQ.

---

## Job Cancellation

Jobs should be cancellable before execution.

---

## Job Rescheduling

Execution time should be modifiable.

---

## Job Status Tracking

Each job should expose its current state.

Possible states include:

* WAITING
* READY
* RUNNING
* SUCCESS
* FAILED
* RETRYING
* DEAD_LETTER
* CANCELLED

---

## Multi-Tenant Support

Different customers should safely share the same scheduler.

Example:

```
Company A

Company B

Company C
```

Each tenant should be isolated.

---

# 8. Non-Goals

The scheduler does **not** execute business logic.

Instead:

```text
Scheduler

↓

Worker

↓

Business Service
```

Examples of responsibilities outside the scheduler:

* payment processing
* invoice generation
* email rendering
* authentication
* PDF generation
* SMS delivery

These belong to dedicated business services.

---

# 9. Learning Objectives

By completing this project, the developer should understand:

## Backend Engineering

* REST APIs
* gRPC
* Protocol Buffers
* NestJS
* Docker
* Kubernetes

---

## Databases

* PostgreSQL
* Redis
* RabbitMQ

Later:

* Cassandra

---

## Distributed Systems

* scheduling
* partitioning
* sharding
* leader election
* heartbeats
* leases
* distributed locks
* retries
* idempotency
* fault tolerance
* consistency
* coordination

---

## Observability

* Prometheus
* Grafana
* OpenTelemetry
* Jaeger
* Loki

---

# 10. Real-World Use Cases

## E-commerce

* abandoned cart reminders
* order confirmation
* return reminders

---

## SaaS

* trial expiration
* subscription renewal
* onboarding emails

---

## Banking

* EMI reminders
* payment retries
* statement generation

---

## CRM

* sales follow-ups
* scheduled meetings
* campaign automation

---

## IoT

* device activation
* firmware updates
* maintenance windows

---

## Notification Systems

* push notifications
* SMS scheduling
* email campaigns

---

## Billing

* recurring invoices
* subscription renewals

---

## Webhooks

* retry failed webhook delivery

---

# 11. System Scope

The project consists of multiple independent services.

```text
Client

↓

REST API

↓

Timer Service

↓

Scanner Service

↓

RabbitMQ

↓

Worker Service

↓

Business Services
```

Each service has a clearly defined responsibility.

Communication between services uses gRPC.

---

# 12. High-Level Architecture

The scheduler consists of two independent planes.

## Timing Plane

Responsible for determining **when** jobs become executable.

```text
Client

↓

API

↓

Timer Store

↓

Scanner

↓

Ready Queue
```

---

## Execution Plane

Responsible for executing business logic.

```text
RabbitMQ

↓

Worker

↓

Notification Service

↓

SMTP
```

Separating timing from execution allows each part of the system to scale independently.

---

# 13. Core Architectural Principles

The project follows several design principles.

## Separation of Concerns

Each service owns one responsibility.

---

## Reliability First

A delayed job must never be silently lost.

---

## Horizontal Scalability

Multiple instances of each service should run simultaneously.

---

## At-Least-Once Delivery

Jobs may execute more than once.

Business services must use idempotency.

---

## Stateless Services

Application services should remain stateless.

Persistent state belongs in databases.

---

## Service Ownership

Each service owns its own domain.

Example:

Timer Service owns waiting jobs.

Workers do not modify timer storage directly.

---

## Asynchronous Communication

Long-running work should occur through messaging.

---

## Observability

Everything should be measurable.

Metrics.

Logs.

Tracing.

Alerts.

---

# 14. Technology Stack

## Language

TypeScript

---

## Framework

NestJS

---

## External Communication

REST API

---

## Internal Communication

gRPC

Protocol Buffers

---

## Primary Database

PostgreSQL

Future migration:

Cassandra

---

## Cache

Redis

---

## Message Queue

RabbitMQ

---

## Object Storage

MinIO

---

## Monitoring

Prometheus

Grafana

---

## Logging

Pino

Loki

---

## Tracing

OpenTelemetry

Jaeger

---

## Containers

Docker

Docker Compose

---

## Production

Kubernetes

---

## Future Coordinator

etcd

---

# 15. Local Development Environment

The project must run entirely on a single laptop.

Docker Compose starts:

```text
API Service

Timer Service

Scanner Service

Worker Service

Cron Service

Coordinator Service

PostgreSQL

RabbitMQ

Redis

MinIO

Prometheus

Grafana

Loki

Jaeger
```

Although everything runs locally, the architecture should mimic a real distributed production environment.

---

# 16. Development Philosophy

The project will be built incrementally.

Rather than building every component at once, the implementation will progress through well-defined milestones:

1. Build a monolithic scheduler.
2. Introduce RabbitMQ.
3. Split services using gRPC.
4. Add Redis for coordination.
5. Implement retries and idempotency.
6. Add observability.
7. Containerize with Docker Compose.
8. Deploy to Kubernetes.
9. Replace selected components (for example, Redis coordination with etcd, PostgreSQL timer storage with Cassandra) as advanced learning phases.

This approach ensures that each distributed systems concept is understood before introducing additional complexity.

---

# 17. Long-Term Vision

The initial implementation is educational.

The long-term goal is to evolve the platform into a production-grade scheduling service capable of supporting:

* millions of scheduled jobs
* multiple scanners
* hundreds of workers
* distributed coordination
* automatic failover
* multi-region deployment
* advanced monitoring
* high availability
* disaster recovery
* cloud-native deployment
* service autoscaling

---

# 18. Success Criteria

The project will be considered successful when it can:

* Reliably schedule one-time, delayed, and recurring jobs.
* Continue operating when individual services fail.
* Scale horizontally by running multiple scanners and workers.
* Demonstrate idempotent execution under duplicate delivery.
* Provide complete observability through logs, metrics, and traces.
* Be deployed locally with Docker Compose and later to Kubernetes without architectural changes.
* Serve as a reference implementation for distributed scheduling systems.

---

# 19. Chapter Summary

This chapter established the motivation, vision, and scope of the Distributed Task Scheduler Platform. It defined why a scheduler is fundamentally different from a queue, outlined the problems the system is intended to solve, identified the project's functional and educational goals, introduced the core architectural principles, and selected the initial technology stack. It also established the philosophy of building the platform incrementally—from a simple local scheduler to a production-style distributed system using NestJS, gRPC, PostgreSQL, Redis, RabbitMQ, Docker, and Kubernetes.

The following chapter (**Chapter 2 – Requirements Engineering**) will translate this vision into detailed functional requirements, non-functional requirements, service-level objectives (SLOs), constraints, assumptions, and acceptance criteria that will guide the remainder of the design and implementation.

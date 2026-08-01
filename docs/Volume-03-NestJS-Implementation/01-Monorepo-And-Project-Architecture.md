# Filename

**`V3-C01-Monorepo-And-Project-Architecture.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 1 — Monorepo & Project Architecture

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 1

**Filename:** `V3-C01-Monorepo-And-Project-Architecture.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why a Monorepo?
3. Monolith vs Monorepo vs Polyrepo
4. Why NestJS?
5. Why Nx?
6. High-Level Project Architecture
7. Repository Structure
8. Applications
9. Shared Libraries
10. Dependency Rules
11. Internal Package Design
12. Environment Configuration
13. Build Strategy
14. Development Workflow
15. Local Development
16. Production Build
17. Future Scaling
18. Best Practices
19. Chapter Summary

---

# 1.1 Introduction

In Volume 1 we designed the **system architecture**.

In Volume 2 we designed the **database**.

Volume 3 begins implementing the platform.

This volume focuses entirely on **NestJS**, **Nx**, **gRPC**, **RabbitMQ**, **Redis**, **PostgreSQL**, and **Docker**.

The first decision every engineering team makes is:

> **How should the source code be organized?**

This decision affects:

- development speed
- testing
- deployments
- code sharing
- team collaboration
- CI/CD
- scalability

For our scheduler, we will use an **Nx Monorepo**.

---

# 1.2 Why a Monorepo?

A monorepo stores multiple applications inside one Git repository.

Example:

```text
Git Repository

├── API Gateway
├── Scheduler Service
├── Worker Service
├── Notification Service
├── Identity Service
├── Shared Libraries
├── Proto Files
└── Infrastructure
```

Instead of maintaining ten separate repositories, everything lives together.

---

## Alternative

Without a monorepo:

```text
scheduler-service

notification-service

worker-service

identity-service

gateway

shared-library

proto-files
```

Six independent repositories.

Problems:

- duplicated code
- duplicated CI
- dependency mismatches
- version conflicts
- difficult refactoring

---

# 1.3 Monolith vs Monorepo vs Polyrepo

These terms are often confused.

They describe different concepts.

---

## Monolith

One application.

```text
Backend

↓

Everything
```

One deployment.

One process.

---

## Monorepo

Many applications.

One Git repository.

```text
Repository

↓

Gateway

↓

Worker

↓

Scheduler

↓

Identity
```

Each service deploys independently.

---

## Polyrepo

Many repositories.

```text
gateway.git

scheduler.git

worker.git

notification.git
```

Every service has its own repository.

---

Our architecture is:

```text
Microservices

+

Monorepo
```

---

# 1.4 Why NestJS?

Our stack already uses Node.js.

NestJS provides:

- Dependency Injection
- Modules
- gRPC support
- RabbitMQ support
- Middleware
- Guards
- Interceptors
- Testing
- Validation
- OpenTelemetry integration

NestJS feels similar to Spring Boot.

Instead of:

```javascript
Express

↓

Routes

↓

Controllers

↓

Everything Manual
```

Nest provides structure.

```text
Controller

↓

Service

↓

Repository

↓

Database
```

Large teams benefit from consistency.

---

# 1.5 Why Nx?

NestJS supports monorepos by itself.

So why use Nx?

Nx adds:

- dependency graph
- incremental builds
- task caching
- affected builds
- code generators
- project boundaries
- workspace management

Without Nx:

```text
npm run build
```

Builds every service.

With Nx:

```text
Changed:

Worker

↓

Only Worker Builds
```

CI becomes dramatically faster.

---

# 1.6 High-Level Architecture

Our repository:

```text
scheduler-platform/

│

├── apps/

├── packages/

├── proto/

├── docker/

├── infra/

├── scripts/

├── tools/

├── docs/

└── nx.json
```

Everything belongs to one workspace.

---

# 1.7 Repository Structure

```text
scheduler-platform/

│

├── apps/

│   ├── api-gateway

│   ├── scheduler-service

│   ├── scanner-service

│   ├── dispatcher-service

│   ├── worker-service

│   ├── notification-service

│   ├── identity-service

│   ├── audit-service

│   ├── monitoring-service

│   └── config-service

│

├── packages/

│

├── proto/

│

├── docker/

│

├── infra/

│

├── scripts/

│

└── docs/
```

Notice that every deployable service lives inside `apps`.

---

# 1.8 Applications

Each folder inside `apps` becomes one NestJS application.

Example:

```text
apps/

    api-gateway/

    scheduler-service/

    worker-service/

    notification-service/
```

Every application has:

```text
main.ts

app.module.ts

controllers/

services/

grpc/

config/
```

Each application can run independently.

---

# 1.9 Shared Libraries

Most code should **not** be duplicated.

Shared functionality belongs inside `packages`.

Example:

```text
packages/

    database/

    common/

    logging/

    tracing/

    protobuf/

    auth/

    redis/

    rabbitmq/

    grpc/

    utils/

    validation/
```

Applications import shared libraries.

They never copy code.

---

# 1.10 Dependency Rules

A common mistake:

```text
Worker

↓

Imports

↓

Scheduler
```

Bad.

Instead:

```text
Worker

↓

Imports

↓

Shared Library
```

Applications never import another application.

Rule:

```text
apps

↓

packages

↓

Never

↓

apps
```

Only shared packages may be referenced.

---

# 1.11 Internal Package Design

Example:

```text
packages/database/

    entities/

    repositories/

    migrations/

    subscribers/

    decorators/

    interfaces/

    constants/
```

Another:

```text
packages/common/

    dto/

    enums/

    exceptions/

    constants/

    interfaces/

    decorators/

    filters/

    interceptors/
```

Every package has one responsibility.

---

# 1.12 Environment Configuration

Environment variables remain outside source code.

Example:

```text
.env

.env.local

.env.dev

.env.test

.env.production
```

Applications load:

```text
Environment

↓

Configuration Module

↓

Validation

↓

DI Container
```

Never access `process.env` throughout the application.

Instead:

```typescript
ConfigService;
```

injects configuration.

---

# 1.13 Build Strategy

Development:

```text
Run

↓

One Service
```

Production:

```text
Build

↓

Docker Image

↓

Deploy
```

Each service builds independently.

Example:

```bash
nx build scheduler-service
```

or

```bash
nx build worker-service
```

---

# 1.14 Development Workflow

Developer changes:

```text
Worker

↓

Build Worker

↓

Test Worker

↓

Run Worker
```

Gateway remains untouched.

Nx detects affected projects automatically.

---

# 1.15 Local Development

Local machine:

```text
Docker Compose

↓

PostgreSQL

RabbitMQ

Redis

Jaeger

Prometheus

Grafana

Mailhog

↓

NestJS Services
```

Developers run services directly.

Infrastructure runs inside Docker.

Example:

```text
Docker

↓

RabbitMQ
```

NestJS connects locally.

---

# 1.16 Production Build

Production pipeline:

```text
Git Push

↓

CI

↓

Nx Detects Changes

↓

Build

↓

Unit Tests

↓

Integration Tests

↓

Docker Images

↓

Registry

↓

Kubernetes
```

Every service produces its own Docker image.

---

# 1.17 Future Scaling

Today:

```text
One Repository
```

↓

Tomorrow:

```text
200 Engineers
```

↓

Still:

```text
One Repository
```

Google, Uber, and Meta use monorepo-style development because:

- easier refactoring
- shared tooling
- centralized dependency management
- atomic commits across services

Nx brings similar benefits to NestJS.

---

# 1.18 Recommended Folder Structure

```text
scheduler-platform/

│

├── apps/
│   ├── api-gateway/
│   ├── scheduler-service/
│   ├── scanner-service/
│   ├── dispatcher-service/
│   ├── worker-service/
│   ├── notification-service/
│   ├── identity-service/
│   ├── audit-service/
│   ├── monitoring-service/
│   └── config-service/

│

├── packages/
│   ├── common/
│   ├── database/
│   ├── auth/
│   ├── grpc/
│   ├── rabbitmq/
│   ├── redis/
│   ├── protobuf/
│   ├── logging/
│   ├── tracing/
│   ├── validation/
│   ├── cache/
│   ├── telemetry/
│   └── testing/

│

├── proto/

├── docker/

├── infra/
│   ├── kubernetes/
│   ├── helm/
│   └── terraform/

├── scripts/

├── docs/

├── .github/

├── nx.json

├── package.json

├── tsconfig.base.json

└── docker-compose.yml
```

This layout cleanly separates deployable applications, reusable libraries, infrastructure, and documentation.

---

# 1.19 Why This Architecture Fits Our Scheduler

Our scheduler contains many independent services:

- API Gateway
- Scheduler
- Scanner
- Dispatcher
- Workers
- Notification
- Identity
- Audit
- Monitoring
- Configuration

Despite being separate services, they share:

- DTOs
- Protobuf definitions
- Authentication logic
- Database entities
- Logging
- Tracing
- Utilities
- Validation
- Common exceptions

A monorepo avoids duplication while preserving independent deployments.

---

# 1.20 Best Practices

- Use one monorepo for all scheduler services.
- Place deployable applications under `apps/`.
- Place reusable code under `packages/`.
- Never let one application import another application.
- Share contracts through common libraries.
- Keep infrastructure in Docker and Kubernetes manifests.
- Use Nx for incremental builds and dependency analysis.
- Keep environment configuration centralized.
- Build and deploy each service independently.
- Maintain strict module boundaries.

---

# Chapter Summary

This chapter established the overall code organization for the Distributed Task Scheduler Platform. We selected an **Nx-based NestJS monorepo**, separated deployable services from shared libraries, defined dependency rules, recommended a scalable folder structure, explained local and production build workflows, and laid the architectural foundation for every subsequent implementation chapter. This structure supports independent microservice deployment while maximizing code reuse and developer productivity.

---

# Next Chapter

**Filename:** `V3-C02-Nx-Workspace-And-Code-Generation.md`

**Chapter 2 — Creating the Nx Workspace & Bootstrapping the Project**

In the next chapter we will actually build the workspace from scratch, including:

- Installing Nx
- Creating the workspace
- Configuring TypeScript
- Creating NestJS applications
- Creating shared libraries
- Workspace configuration
- Dependency graph
- Code generators
- Path aliases
- Project boundaries
- Initial Git setup
- Recommended VS Code configuration

This chapter transitions from architecture into the first actual implementation steps.

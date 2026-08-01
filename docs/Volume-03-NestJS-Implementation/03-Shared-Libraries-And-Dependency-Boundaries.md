# Filename

**`V3-C03-Shared-Libraries-And-Dependency-Boundaries.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 3 — Shared Libraries, Dependency Boundaries & Package Architecture

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 3

**Filename:** `V3-C03-Shared-Libraries-And-Dependency-Boundaries.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Shared Libraries Exist
3. Package Philosophy
4. Dependency Rules
5. Library Categories
6. Common Library
7. Database Library
8. Authentication Library
9. gRPC Library
10. RabbitMQ Library
11. Redis Library
12. Logging Library
13. Tracing Library
14. Validation Library
15. Telemetry Library
16. Testing Library
17. Nx Dependency Boundaries
18. Circular Dependency Prevention
19. Import Guidelines
20. Future Evolution
21. Best Practices
22. Chapter Summary

---

# 3.1 Introduction

Our scheduler consists of many independent applications.

```text
API Gateway

Scheduler

Scanner

Dispatcher

Worker

Notification

Identity

Audit

Monitoring

Configuration
```

Although each application has a different responsibility, they all require common functionality.

Examples:

- Logging
- Database access
- Authentication
- Redis
- RabbitMQ
- gRPC
- DTOs
- Validation
- Error handling

Copying these into every application would quickly become impossible to maintain.

Instead, we create **shared libraries**.

---

# 3.2 Why Shared Libraries Exist

Imagine ten services each needing:

```typescript
LoggerService;
```

Without shared libraries:

```text
API Gateway
    Logger

Scheduler
    Logger

Worker
    Logger

Notification
    Logger
```

Ten different implementations.

Eventually they diverge.

Instead:

```text
packages/

    logging/

↓

All Services
```

One implementation.

One source of truth.

---

# 3.3 Package Philosophy

Every package must have **one responsibility**.

Bad:

```text
common/

    Logger

    Redis

    Database

    DTO

    JWT

    RabbitMQ
```

Everything mixed together.

Good:

```text
logging/

database/

redis/

rabbitmq/

grpc/

auth/
```

Each package solves one problem.

This follows the **Single Responsibility Principle (SRP)**.

---

# 3.4 Dependency Rules

One of the biggest causes of microservice codebase decay is uncontrolled dependencies.

We define strict rules.

```text
Applications

↓

Libraries

↓

Never

↓

Applications
```

Meaning:

✅ Allowed

```text
Worker

↓

Database
```

❌ Forbidden

```text
Worker

↓

Scheduler
```

Applications never import another application.

---

# 3.5 Package Categories

Our workspace contains two kinds of projects.

### Deployable Applications

```text
apps/
```

Examples:

```text
api-gateway

worker-service

scheduler-service
```

---

### Reusable Libraries

```text
packages/
```

Examples:

```text
database

logging

grpc

rabbitmq
```

Libraries never run independently.

Applications consume them.

---

# 3.6 Common Library

Directory:

```text
packages/common
```

Purpose:

Everything truly shared across every service.

Recommended structure:

```text
common/

├── constants/

├── enums/

├── exceptions/

├── decorators/

├── interfaces/

├── dto/

├── filters/

├── interceptors/

├── pipes/

├── types/

└── utils/
```

---

Examples:

```typescript
AppException;

BaseResponseDto;

PaginationDto;

ApiError;

ExecutionStatus;

RetryStrategy;

TenantContext;
```

This package should contain **zero business logic**.

---

# 3.7 Database Library

Directory:

```text
packages/database
```

Purpose:

Everything related to PostgreSQL.

Structure:

```text
database/

├── entities/

├── repositories/

├── migrations/

├── subscribers/

├── decorators/

├── config/

├── datasource/

└── module.ts
```

Responsibilities:

- TypeORM configuration
- Entity definitions
- Repository implementations
- Transaction helpers
- Database health checks

No service-specific logic belongs here.

---

# 3.8 Authentication Library

Directory:

```text
packages/auth
```

Responsibilities:

- JWT verification
- JWT generation
- Guards
- CurrentUser decorator
- RBAC
- Permission decorators
- Tenant extraction
- Service-to-service authentication

Structure:

```text
auth/

├── guards/

├── decorators/

├── jwt/

├── rbac/

├── interfaces/

├── strategies/

└── module.ts
```

Every service imports the same authentication package.

---

# 3.9 gRPC Library

Directory:

```text
packages/grpc
```

Purpose:

Centralize gRPC client configuration.

Structure:

```text
grpc/

├── clients/

├── interceptors/

├── protobuf-loader/

├── serializers/

├── config/

└── module.ts
```

Responsibilities:

- Client factories
- Channel configuration
- Retry policies
- Deadlines
- Metadata helpers
- Authentication metadata

No `.proto` files are stored here.

---

# 3.10 Protobuf Library

Directory:

```text
packages/protobuf
```

Contains:

```text
scheduler.proto

worker.proto

notification.proto

identity.proto

audit.proto
```

These files define service contracts.

Every application imports generated types from this package.

Never duplicate protobuf definitions.

---

# 3.11 RabbitMQ Library

Directory:

```text
packages/rabbitmq
```

Purpose:

Abstract messaging.

Structure:

```text
rabbitmq/

├── producer/

├── consumer/

├── exchanges/

├── queues/

├── serializers/

├── config/

└── module.ts
```

Responsibilities:

- Connection management
- Exchange declaration
- Queue declaration
- Publisher confirms
- Consumer registration
- Dead-letter configuration

Applications should never manually create RabbitMQ connections.

---

# 3.12 Redis Library

Directory:

```text
packages/redis
```

Responsibilities:

- Redis connection
- Distributed locks
- Leases
- Cache abstraction
- Pub/Sub
- Lua scripts

Structure:

```text
redis/

├── cache/

├── locks/

├── pubsub/

├── scripts/

├── config/

└── module.ts
```

Scanner, Dispatcher, and Worker all share this package.

---

# 3.13 Logging Library

Directory:

```text
packages/logging
```

Purpose:

Structured logging.

Structure:

```text
logging/

├── logger.service.ts

├── context/

├── formatters/

├── transports/

├── middleware/

└── module.ts
```

Responsibilities:

- JSON logging
- Correlation IDs
- Trace IDs
- Request logging
- Performance logging

No service creates its own logger.

---

# 3.14 Tracing Library

Directory:

```text
packages/tracing
```

Purpose:

OpenTelemetry integration.

Structure:

```text
tracing/

├── tracer/

├── spans/

├── propagators/

├── exporters/

└── module.ts
```

Responsibilities:

- Trace creation
- Span helpers
- Context propagation
- gRPC propagation
- RabbitMQ propagation

---

# 3.15 Validation Library

Directory:

```text
packages/validation
```

Contains:

```text
validators/

pipes/

constraints/

schemas/

decorators/
```

Responsibilities:

- Custom validators
- Validation pipes
- Shared schemas
- Request validation

Every DTO uses the same validation framework.

---

# 3.16 Telemetry Library

Directory:

```text
packages/telemetry
```

Purpose:

Metrics.

Responsibilities:

- Prometheus metrics
- Counters
- Gauges
- Histograms
- Scheduler metrics
- Worker metrics

Example:

```typescript
JobsExecutedCounter;

QueueDepthGauge;

WorkerLatencyHistogram;
```

---

# 3.17 Testing Library

Directory:

```text
packages/testing
```

Contains:

```text
factories/

fixtures/

mocks/

builders/

helpers/

fake-services/
```

Purpose:

Reuse test utilities across all applications.

Example:

```typescript
FakeRabbitMQ;

FakeRedis;

FakeClock;

FakeSchedulerRepository;
```

---

# 3.18 Nx Dependency Boundaries

Nx allows dependency constraints using tags.

Example:

```json
{
  "tags": ["scope:scheduler", "type:app"]
}
```

Libraries:

```json
{
  "tags": ["scope:shared", "type:lib"]
}
```

Rules:

```text
App

↓

Shared Library

↓

Allowed
```

```text
Shared Library

↓

Application

↓

Forbidden
```

Nx can enforce these rules during linting.

---

# 3.19 Circular Dependency Prevention

Circular imports are dangerous.

Bad:

```text
Database

↓

Logging

↓

Database
```

Application startup may fail.

Better:

```text
Logging

↓

No Database Dependency
```

And:

```text
Database

↓

Logging Interface
```

Not the concrete implementation.

Dependency inversion prevents cycles.

---

# 3.20 Import Guidelines

Good imports:

```typescript
import { LoggerService } from "@scheduler/logging";

import { RedisModule } from "@scheduler/redis";

import { DatabaseModule } from "@scheduler/database";

import { AuthModule } from "@scheduler/auth";
```

Bad:

```typescript
import { JobService } from "../../../scheduler-service/src/...";
```

Applications must never reach into another application's source code.

---

# 3.21 Complete Dependency Diagram

```text
                    Applications
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
 API Gateway         Scheduler          Worker
        │                  │                  │
        └──────────────┬───┴──────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    Common        Database        Logging
        │              │              │
        ├──────────────┼──────────────┤
        ▼              ▼              ▼
      Redis        RabbitMQ         gRPC
                       │
                       ▼
                  Telemetry
                       │
                       ▼
                    Tracing
```

Notice that dependencies always point **downward** toward shared libraries.

---

# 3.22 Future Evolution

As the platform grows, additional libraries may be introduced:

```text
packages/

├── cache/

├── scheduler-sdk/

├── notification-sdk/

├── workflow-engine/

├── rate-limiter/

├── feature-flags/

├── secrets/

├── policy-engine/

└── ai/
```

These can be added without affecting the existing application boundaries.

---

# 3.23 Best Practices

- One responsibility per library.
- Never duplicate shared code across services.
- Keep business logic out of shared packages unless it is truly reusable.
- Do not let applications depend on other applications.
- Use Nx tags to enforce dependency boundaries.
- Prevent circular dependencies through dependency inversion.
- Centralize infrastructure concerns (Redis, RabbitMQ, gRPC, Logging).
- Share DTOs and interfaces through common packages.
- Keep protobuf contracts in a dedicated package.
- Keep libraries small, cohesive, and independently testable.

---

# Chapter Summary

This chapter designed the shared library architecture for the Distributed Task Scheduler Platform. We defined the purpose and internal structure of each reusable package, established strict dependency rules, introduced Nx dependency boundaries, prevented circular dependencies, and separated deployable applications from shared infrastructure code. This architecture enables independent microservices while maximizing code reuse, consistency, and maintainability across the entire platform.

---

# Next Chapter

**Filename:** `V3-C04-Configuration-And-Environment-Management.md`

**Chapter 4 — Configuration, Environment Variables & Secrets Management**

The next chapter will implement one of the most critical cross-cutting concerns in the platform: configuration management. We will design a centralized `ConfigModule`, typed configuration services, environment validation with Zod, secret handling, per-service configuration, Docker and Kubernetes integration, runtime overrides, and strategies for securely managing configuration across development, testing, and production.

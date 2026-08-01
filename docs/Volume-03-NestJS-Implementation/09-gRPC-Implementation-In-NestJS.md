# Filename

**`V3-C09-gRPC-Implementation-In-NestJS.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 9 — Implementing gRPC Servers & Clients in NestJS

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 9

**Filename:** `V3-C09-gRPC-Implementation-In-NestJS.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Implementation Goals
3. NestJS gRPC Architecture
4. gRPC Server Implementation
5. gRPC Client Implementation
6. Shared gRPC Module
7. Client Factory
8. Metadata Propagation
9. Authentication
10. Deadlines
11. Interceptors
12. Exception Handling
13. Health Checks
14. Request Flow
15. Performance
16. Future Evolution
17. Best Practices
18. Chapter Summary

---

# 9.1 Introduction

In the previous chapter we designed the `.proto` contracts.

Those files define **what** services can do.

This chapter focuses on **how those contracts are implemented in NestJS**.

By the end of this chapter every microservice will expose:

- a gRPC server
- one or more gRPC clients
- metadata propagation
- authentication
- deadlines
- interceptors
- standardized exception handling

---

# 9.2 High-Level Architecture

Every service acts as both:

- Server
- Client

Example:

```text
                Scheduler Service

        ┌──────────────────────────┐

        │      gRPC Server          │

        └─────────────┬─────────────┘

                      │

                Scheduler Logic

                      │

        ┌─────────────┴─────────────┐

        │      gRPC Client          │

        └───────────────────────────┘

             │             │

             ▼             ▼

       Identity      Notification
```

The Scheduler exposes APIs while also consuming APIs from other services.

---

# 9.3 NestJS gRPC Layer

A typical request flows through several layers.

```text
Incoming Request

↓

HTTP/2

↓

Protocol Buffers

↓

NestJS Transport

↓

Controller

↓

Service

↓

Repository

↓

Database

↓

Response

↓

Protocol Buffers

↓

HTTP/2
```

NestJS hides most serialization details.

Developers work with TypeScript objects.

---

# 9.4 gRPC Server

Each service exposes one server.

Example:

```text
Worker Service

↓

gRPC Server

↓

worker.proto
```

Internally:

```text
main.ts

↓

Microservice Transport

↓

Controller

↓

Service
```

The server listens on its own port.

Example:

```text
Worker

50053
```

Identity:

```text
50051
```

Scheduler:

```text
50052
```

---

# 9.5 Bootstrapping a gRPC Server

Every service starts similarly.

```typescript
const app = await NestFactory.createMicroservice(AppModule, {
  transport: Transport.GRPC,
  options: {
    package: "scheduler",
    protoPath: "proto/scheduler.proto",
    url: "0.0.0.0:50052",
  },
});

await app.listen();
```

Responsibilities:

- Load `.proto`
- Register package
- Bind port
- Start gRPC transport

The application does **not** expose HTTP unless explicitly required.

---

# 9.6 gRPC Controllers

Instead of HTTP controllers:

```typescript
@Controller()
export class SchedulerGrpcController {}
```

Methods map directly to RPC definitions.

Example flow:

```text
CreateJob()

↓

SchedulerGrpcController

↓

SchedulerService

↓

Repository
```

The controller should remain thin.

Business logic belongs inside services.

---

# 9.7 gRPC Client

Every service also consumes other services.

Example:

```text
Worker

↓

Identity Client

↓

Identity Service
```

Instead of manually opening connections:

```text
Worker

↓

GrpcModule

↓

Client Factory

↓

Connection
```

Everything is centralized.

---

# 9.8 Shared gRPC Module

Project:

```text
packages/grpc/

├── grpc.module.ts

├── client.factory.ts

├── metadata/

├── interceptors/

├── auth/

├── health/

├── config/

└── utils/
```

Every application imports:

```typescript
GrpcModule;
```

instead of configuring clients repeatedly.

---

# 9.9 Client Factory

A factory creates clients consistently.

Instead of:

```text
Worker

↓

Manual Configuration
```

and

```text
Scheduler

↓

Different Configuration
```

We use:

```text
Client Factory

↓

Configured Client

↓

Worker

Scheduler

Notification
```

Benefits:

- identical retries
- identical deadlines
- identical authentication
- centralized configuration

---

# 9.10 Dependency Injection

NestJS injects clients.

```text
Controller

↓

Service

↓

IdentityClient

↓

gRPC
```

Services never create clients manually.

Advantages:

- easier testing
- mocking
- lifecycle management

---

# 9.11 Metadata Propagation

Every request carries metadata.

```text
Request

↓

Metadata

↓

Handler
```

Typical metadata:

```text
Authorization

Trace ID

Correlation ID

Tenant ID

User ID

Locale

Request ID
```

Metadata is separate from protobuf messages.

---

# 9.12 Context Flow

Suppose a request begins:

```text
Browser

↓

Gateway

↓

Scheduler

↓

Dispatcher

↓

Worker

↓

Notification
```

Every service receives:

```text
Trace ID

Correlation ID

Tenant ID
```

Logs across services become searchable.

---

# 9.13 Authentication

Every internal request is authenticated.

Workflow:

```text
Scheduler

↓

JWT

↓

Metadata

↓

Worker

↓

Verification
```

The receiving service validates:

- Signature
- Expiration
- Audience
- Service Identity
- Roles

No service trusts incoming metadata blindly.

---

# 9.14 Deadlines

Every RPC has a timeout.

Example:

```text
Worker

↓

Identity

↓

Deadline

2 Seconds
```

If exceeded:

```text
DEADLINE_EXCEEDED
```

This prevents:

```text
Worker

↓

Waiting Forever
```

Deadlines should always be configured.

---

# 9.15 Retry Strategy

Only transient failures should retry.

Example:

```text
Unavailable

↓

Retry
```

Example:

```text
Network Timeout

↓

Retry
```

Not retried:

```text
Permission Denied
```

```text
Invalid Argument
```

Retries are centralized inside the client factory.

---

# 9.16 Interceptors

NestJS interceptors execute around requests.

Example:

```text
Request

↓

Logging Interceptor

↓

Authentication Interceptor

↓

Tracing Interceptor

↓

Metrics Interceptor

↓

Controller
```

Common interceptors:

- Logging
- Metrics
- Tracing
- Authentication
- Exception Mapping

Every service shares the same interceptor pipeline.

---

# 9.17 Exception Handling

Business exceptions should never leak implementation details.

Instead:

```text
Database Error

↓

Exception Filter

↓

gRPC Status

↓

Client
```

Examples:

| Internal Exception | gRPC Status       |
| ------------------ | ----------------- |
| EntityNotFound     | NOT_FOUND         |
| ValidationError    | INVALID_ARGUMENT  |
| DuplicateKey       | ALREADY_EXISTS    |
| Unauthorized       | UNAUTHENTICATED   |
| Forbidden          | PERMISSION_DENIED |

The client receives standardized responses.

---

# 9.18 Health Service

Every service exposes a health RPC.

```text
Monitoring

↓

Health RPC

↓

Worker

↓

Healthy?
```

Response:

```text
Status

Version

Uptime

Dependencies
```

Monitoring uses these endpoints for service discovery and health dashboards.

---

# 9.19 Connection Management

Each service maintains persistent HTTP/2 connections.

```text
Worker

↓

Persistent Channel

↓

Identity
```

Not:

```text
New Connection

↓

Every Request
```

Persistent channels improve:

- latency
- CPU usage
- throughput

---

# 9.20 Request Lifecycle

A complete request:

```text
Gateway

↓

Scheduler Client

↓

Scheduler Server

↓

Controller

↓

Service

↓

Repository

↓

PostgreSQL

↓

Repository

↓

Service

↓

Controller

↓

gRPC Response

↓

Gateway
```

Every layer has a clear responsibility.

---

# 9.21 Performance Considerations

Recommendations:

- Reuse channels.
- Keep protobuf messages small.
- Avoid unnecessary nested objects.
- Configure deadlines.
- Use streaming when appropriate.
- Avoid large payloads.
- Use compression only when payloads justify it.
- Pool client connections.
- Monitor latency.
- Instrument every request.

---

# 9.22 Scheduler Communication Example

A worker finishes a job.

Workflow:

```text
Worker

↓

SchedulerClient

↓

UpdateExecution()

↓

Scheduler Server

↓

ExecutionService

↓

ExecutionRepository

↓

Database

↓

Response

↓

Worker

↓

RabbitMQ ACK
```

Notice that the Worker acknowledges the RabbitMQ message **only after** receiving a successful gRPC response, ensuring consistency between message processing and scheduler state.

---

# 9.23 Complete gRPC Architecture

```text
                    API Gateway

                          │

                      HTTP/REST

                          ▼

                Scheduler Service

              ┌──────────┴──────────┐

              ▼                     ▼

        gRPC Server           gRPC Clients

              │                     │

      SchedulerService      Identity Client

                             Notification Client

                             Config Client

              │

              ▼

        Business Logic

              ▼

        Repository Layer

              ▼

          PostgreSQL
```

Every service follows the same structure, making the platform predictable and easy to maintain.

---

# 9.24 Future Evolution

Current architecture:

```text
Unary RPC
```

↓

Future enhancements:

```text
Client-side Load Balancing
```

↓

```text
Circuit Breakers
```

↓

```text
Service Mesh

(Istio / Linkerd)
```

↓

```text
Mutual TLS (mTLS)
```

↓

```text
Automatic Service Discovery
```

The application code remains unchanged while the communication infrastructure evolves.

---

# 9.25 Best Practices

- One gRPC server per service.
- Use a shared `GrpcModule`.
- Centralize client creation with a factory.
- Inject clients through NestJS Dependency Injection.
- Propagate metadata on every request.
- Authenticate all internal traffic.
- Set deadlines for every RPC.
- Retry only transient failures.
- Standardize exception mapping.
- Keep controllers thin and place business logic in services.

---

# Chapter Summary

This chapter implemented the gRPC communication layer in NestJS. We built reusable gRPC servers and clients, centralized configuration through a shared `GrpcModule`, propagated metadata, authenticated internal requests, configured deadlines and retries, introduced interceptors and exception handling, and designed a consistent request lifecycle. This infrastructure enables every microservice in the scheduler platform to communicate efficiently, securely, and predictably while remaining independently deployable.

---

# Next Chapter

**Filename:** `V3-C10-RabbitMQ-Architecture-And-Messaging.md`

**Chapter 10 — RabbitMQ Architecture, Exchanges, Queues & Messaging Patterns**

The next chapter will move from synchronous gRPC communication to asynchronous messaging. We will design the complete RabbitMQ infrastructure for the scheduler, including exchanges, queues, routing keys, publisher confirms, acknowledgements, dead-letter queues, retry queues, consumer prefetch, message ordering, idempotent consumers, and how Scanner, Dispatcher, Workers, and Notification services communicate asynchronously.

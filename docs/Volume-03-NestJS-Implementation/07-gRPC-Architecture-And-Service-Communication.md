# Filename

**`V3-C07-gRPC-Architecture-And-Service-Communication.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 7 — gRPC Architecture & Inter-Service Communication

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 7

**Filename:** `V3-C07-gRPC-Architecture-And-Service-Communication.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why gRPC?
3. Communication Architecture
4. HTTP vs gRPC
5. Protocol Buffers
6. Service Contracts
7. NestJS gRPC Server
8. NestJS gRPC Client
9. Service Discovery
10. Metadata
11. Authentication
12. Deadlines & Timeouts
13. Retries
14. Error Handling
15. Streaming
16. Versioning
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 7.1 Introduction

Our scheduler is composed of multiple independent microservices.

Examples:

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

These services must communicate.

The communication should be:

- Fast
- Typed
- Efficient
- Reliable
- Language-independent
- Backward compatible

Instead of HTTP REST between services, we will use **gRPC**.

HTTP will only be exposed to external clients.

---

# 7.2 Overall Communication Architecture

The platform uses two communication methods.

```text
                External Client

                       │

                  HTTP/REST

                       │

               API Gateway

        ┌──────────────┼──────────────┐

        ▼              ▼              ▼

 Identity        Scheduler      Notification

        │              │              │

        └──────────────┼──────────────┘

                 gRPC Communication

                       │

                 Internal Network
```

Rule:

- External → HTTP
- Internal → gRPC

---

# 7.3 Why gRPC?

REST works well.

So why not use REST internally?

REST sends:

```text
HTTP

↓

Headers

↓

JSON

↓

Text Parsing
```

gRPC sends:

```text
HTTP/2

↓

Binary Protocol

↓

Protocol Buffers

↓

Much Smaller Payload
```

Benefits:

- Faster serialization
- Smaller messages
- Strong typing
- Auto-generated code
- Streaming
- Built-in deadlines

---

# 7.4 HTTP vs gRPC

| Feature          | REST     | gRPC            |
| ---------------- | -------- | --------------- |
| Protocol         | HTTP/1.1 | HTTP/2          |
| Data             | JSON     | Protobuf Binary |
| Speed            | Good     | Excellent       |
| Payload Size     | Large    | Small           |
| Streaming        | Limited  | Native          |
| Strong Types     | No       | Yes             |
| Code Generation  | Manual   | Automatic       |
| Browser Friendly | Yes      | Limited         |
| Internal APIs    | Good     | Excellent       |

For microservices, gRPC is the better choice.

---

# 7.5 Communication Patterns

Our scheduler uses three communication styles.

### Request / Response

```text
Worker

↓

Identity

↓

Validate Token

↓

Response
```

---

### Fire-and-Forget

```text
Dispatcher

↓

RabbitMQ

↓

Worker
```

---

### Streaming

```text
Monitoring

↓

Continuous Metrics Stream
```

Each pattern has a different use case.

---

# 7.6 Protocol Buffers

gRPC uses Protocol Buffers (protobuf) instead of JSON.

Instead of:

```json
{
  "jobId": "123",
  "status": "RUNNING"
}
```

Data is encoded into a compact binary format.

Advantages:

- Smaller
- Faster
- Strongly typed
- Backward compatible

---

# 7.7 Project Structure

```text
proto/

├── scheduler.proto

├── worker.proto

├── notification.proto

├── identity.proto

├── audit.proto

├── monitoring.proto

├── config.proto

└── common.proto
```

Every service owns its own contract.

---

# 7.8 Service Contracts

Each microservice exposes a contract.

Example:

```text
Scheduler Service

↓

scheduler.proto
```

Defines:

- CreateJob
- CancelJob
- PauseSchedule
- ResumeSchedule
- GetJob

Clients only know the contract.

They know nothing about implementation.

---

# 7.9 Communication Flow

Example:

```text
Worker

↓

gRPC Client

↓

Identity Service

↓

Validate API Key

↓

Response
```

Worker never queries Identity database directly.

Only the owning service accesses its own database.

---

# 7.10 NestJS gRPC Server

Each service exposes a gRPC server.

Example:

```text
Scheduler Service

↓

NestJS

↓

gRPC Server

↓

scheduler.proto
```

Incoming requests are handled by controllers.

---

# 7.11 NestJS gRPC Client

Every service also contains gRPC clients.

Example:

```text
Worker

↓

Identity Client

↓

Identity Service
```

Notification:

```text
Notification

↓

Configuration Client
```

Scheduler:

```text
Scheduler

↓

Audit Client
```

Clients are injected using Dependency Injection.

---

# 7.12 Shared gRPC Package

Instead of configuring clients repeatedly:

```text
packages/grpc/

├── client-factory/

├── interceptors/

├── metadata/

├── serializers/

├── config/

├── health/

└── module.ts
```

Every service imports the shared package.

---

# 7.13 Service Discovery

Development:

```text
Docker Compose

↓

scheduler-service

↓

identity-service

↓

notification-service
```

Hostnames become:

```text
identity-service

scheduler-service

worker-service
```

Production:

```text
Kubernetes DNS
```

Example:

```text
identity-service.default.svc.cluster.local
```

Clients never hardcode IP addresses.

---

# 7.14 Metadata

Every gRPC request carries metadata.

Example:

```text
Request

↓

Metadata

↓

Handler
```

Metadata contains:

- Trace ID
- Correlation ID
- Tenant ID
- User ID
- Authorization Token
- Request ID
- Locale

Business data stays inside the protobuf message.

Operational data goes into metadata.

---

# 7.15 Authentication

Every internal request must be authenticated.

Workflow:

```text
Scheduler

↓

JWT

↓

Metadata

↓

Identity Service

↓

Verified
```

The receiving service validates:

- Signature
- Expiration
- Service Identity
- Permissions

Internal communication is never anonymous.

---

# 7.16 Context Propagation

Suppose a request begins here:

```text
API Gateway
```

Then:

```text
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

Logs across services can be connected.

---

# 7.17 Deadlines

Requests should never wait forever.

Example:

```text
Worker

↓

Identity

↓

Timeout

2 Seconds
```

If exceeded:

```text
Deadline Exceeded
```

The Worker continues gracefully.

Deadlines prevent cascading failures.

---

# 7.18 Retry Strategy

Transient failures happen.

Example:

```text
Network Error
```

Retry:

```text
Attempt 1

↓

Attempt 2

↓

Attempt 3
```

Stop.

Do **not** retry forever.

Only retry:

- Unavailable
- Deadline exceeded
- Temporary network errors

Never retry:

- Invalid argument
- Permission denied
- Not found (unless expected to appear later)

---

# 7.19 Error Handling

Every service returns standardized errors.

Example:

```text
INVALID_ARGUMENT

NOT_FOUND

ALREADY_EXISTS

PERMISSION_DENIED

UNAUTHENTICATED

INTERNAL

UNAVAILABLE

DEADLINE_EXCEEDED
```

The API Gateway translates these into HTTP responses for external clients.

---

# 7.20 Streaming

Some services continuously produce data.

Example:

```text
Monitoring

↓

CPU

↓

Memory

↓

Queue Depth

↓

Worker Count
```

Instead of:

```text
Request

↓

Response
```

Use:

```text
Continuous Stream
```

Streaming reduces repeated polling.

---

# 7.21 Unary vs Streaming

Unary:

```text
Client

↓

One Request

↓

One Response
```

Example:

```text
Get Job
```

---

Server Streaming:

```text
One Request

↓

Many Responses
```

Example:

```text
Metrics Stream
```

---

Client Streaming:

```text
Many Requests

↓

One Response
```

Example:

Bulk metrics upload.

---

Bidirectional Streaming:

```text
Many Requests

↓

Many Responses
```

Useful for real-time synchronization.

---

# 7.22 Versioning

Never break existing clients.

Instead:

```text
scheduler.v1
```

Later:

```text
scheduler.v2
```

New fields should always be:

- Optional
- Backward compatible

Never reuse protobuf field numbers.

---

# 7.23 Scheduler Communication Matrix

| Caller       | Target        | Purpose               |
| ------------ | ------------- | --------------------- |
| API Gateway  | Identity      | Authentication        |
| API Gateway  | Scheduler     | Job Management        |
| Scheduler    | Audit         | Audit Events          |
| Scheduler    | Notification  | Notification Requests |
| Scheduler    | Configuration | Runtime Config        |
| Worker       | Scheduler     | Job Updates           |
| Worker       | Monitoring    | Metrics               |
| Notification | Configuration | Provider Settings     |
| Monitoring   | Configuration | Alert Rules           |

Every communication path is explicit.

---

# 7.24 Complete Architecture

```text
               API Gateway

                     │

                HTTP/REST

                     ▼

      ┌─────────────────────────────┐

      │      Internal Network       │

      └─────────────────────────────┘

        │         │          │

        ▼         ▼          ▼

 Scheduler   Identity   Notification

        │         │          │

        └─────────┼──────────┘

                  ▼

              gRPC Clients

                  ▼

            Protocol Buffers

                  ▼

            HTTP/2 Transport
```

---

# 7.25 Future Evolution

Current:

```text
Unary RPC
```

↓

Later:

```text
Streaming
```

↓

```text
Load Balancing
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
Mutual TLS
```

The communication layer evolves independently from business logic.

---

# 7.26 Best Practices

- Use HTTP only at the API Gateway.
- Use gRPC for all internal service communication.
- Keep protobuf files as the single source of truth.
- Never access another service's database directly.
- Propagate trace and correlation IDs through metadata.
- Set deadlines on every request.
- Retry only transient failures.
- Use streaming where continuous updates are required.
- Maintain backward-compatible protobuf contracts.
- Authenticate every internal request.

---

# Chapter Summary

This chapter designed the complete gRPC communication architecture for the Distributed Task Scheduler Platform. We established the distinction between external REST APIs and internal gRPC communication, designed protobuf contracts, configured client-server interactions, introduced metadata propagation, authentication, deadlines, retries, streaming, versioning, and service discovery. This communication layer enables efficient, strongly typed, and scalable interactions between every NestJS microservice.

---

# Next Chapter

**Filename:** `V3-C08-Protocol-Buffers-And-API-Contract-Design.md`

**Chapter 8 — Protocol Buffers, API Contracts & Code Generation**

The next chapter will dive deeply into Protocol Buffers themselves. We will design `.proto` files for every service, explain messages, enums, services, RPC definitions, backward compatibility, field numbering, generated TypeScript code, Buf tooling, validation strategies, and how contracts evolve safely as the scheduler grows.

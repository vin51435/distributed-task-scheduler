# Chapter 9 — gRPC Design & Protocol Buffers

**Document:** Distributed Task Scheduler Platform
**Chapter:** 9
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why gRPC?
3. Why Protocol Buffers?
4. Communication Architecture
5. Service Contracts
6. Proto File Organization
7. Message Design
8. gRPC Services
9. Error Handling
10. Deadlines & Timeouts
11. Retries
12. Streaming
13. Versioning
14. Security
15. Observability
16. NestJS Integration
17. Best Practices
18. Chapter Summary

---

# 9.1 Introduction

The REST API is the public interface of the scheduler.

However, communication **between internal services** uses **gRPC**.

Instead of exchanging JSON over HTTP, services exchange compact binary messages defined using **Protocol Buffers (protobuf)**.

This provides:

- Faster communication
- Strong typing
- Automatic client generation
- Smaller payloads
- Language independence

---

# 9.2 Why gRPC?

The scheduler contains many microservices.

```text
API

↓

Timer

↓

Coordinator

↓

Audit
```

These services communicate thousands of times every second.

Using REST internally would introduce:

- larger payloads
- JSON serialization overhead
- inconsistent APIs

gRPC solves these problems.

---

## Advantages

- Binary protocol
- HTTP/2
- Multiplexing
- Strong contracts
- Code generation
- Streaming
- Lower latency

---

## Disadvantages

- Harder to debug manually
- Browser support is limited
- Less human-readable than REST

---

## Why REST + gRPC?

| REST             | gRPC              |
| ---------------- | ----------------- |
| External clients | Internal services |
| Human-readable   | Machine optimized |
| JSON             | Binary            |
| Easy integration | High performance  |

---

# 9.3 Why Protocol Buffers?

Protocol Buffers define the communication contract.

Instead of manually writing DTOs in every service,

we define them once.

Example

```proto
syntax = "proto3";

message JobRequest {
    string job_id = 1;
}
```

Then code is generated automatically.

Benefits:

- Type safety
- Consistency
- Backward compatibility
- Smaller payloads

---

# 9.4 Communication Architecture

Internal communication follows this pattern.

```text
REST API

↓

gRPC

↓

Timer Service

↓

gRPC

↓

Coordinator

↓

Redis
```

Another example

```text
Worker

↓

gRPC

↓

Audit Service
```

RabbitMQ remains responsible for asynchronous execution.

---

# 9.5 Service Contracts

Each service exposes a well-defined interface.

Example

```text
API

↓

Timer Service

CreateJob()

CancelJob()

UpdateJob()
```

Clients only know the contract.

They never know implementation details.

---

# 9.6 Proto File Organization

Repository

```text
shared/

└── proto/

    ├── common.proto
    ├── timer.proto
    ├── worker.proto
    ├── audit.proto
    ├── coordinator.proto
    ├── notification.proto
    └── health.proto
```

Each service owns its own proto file.

Shared messages belong in `common.proto`.

---

# 9.7 Message Design

Messages should be small and focused.

Example

```proto
message CreateJobRequest {
    string tenant_id = 1;
    string handler = 2;
    string payload = 3;
    int64 execute_at = 4;
}
```

Response

```proto
message CreateJobResponse {
    string job_id = 1;
    string status = 2;
}
```

Avoid sending unnecessary fields.

---

## Field Numbering

Each field has a unique number.

```proto
string job_id = 1;
string tenant_id = 2;
```

Never reuse removed field numbers.

Instead

```proto
reserved 5;
```

This preserves backward compatibility.

---

# 9.8 gRPC Services

## Timer Service

```proto
service TimerService {

    rpc CreateJob(CreateJobRequest)
        returns (CreateJobResponse);

    rpc CancelJob(CancelJobRequest)
        returns (CancelJobResponse);

    rpc UpdateJob(UpdateJobRequest)
        returns (UpdateJobResponse);

    rpc GetJob(GetJobRequest)
        returns (GetJobResponse);
}
```

---

## Coordinator Service

```proto
service CoordinatorService {

    rpc AcquireLease(LeaseRequest)
        returns (LeaseResponse);

    rpc RenewLease(HeartbeatRequest)
        returns (HeartbeatResponse);
}
```

---

## Audit Service

```proto
service AuditService {

    rpc RecordExecution(
        AuditRequest
    )
    returns (AuditResponse);
}
```

---

## Notification Service

```proto
service NotificationService {

    rpc SendNotification(
        NotificationRequest
    )
    returns (NotificationResponse);
}
```

---

# 9.9 Error Handling

gRPC uses standard status codes.

| Code              | Meaning             |
| ----------------- | ------------------- |
| OK                | Success             |
| INVALID_ARGUMENT  | Validation failed   |
| NOT_FOUND         | Resource missing    |
| ALREADY_EXISTS    | Duplicate           |
| PERMISSION_DENIED | Authorization       |
| UNAVAILABLE       | Service unavailable |
| DEADLINE_EXCEEDED | Timeout             |
| INTERNAL          | Unexpected error    |

Services should never expose stack traces.

---

# 9.10 Deadlines & Timeouts

Every gRPC request should define a deadline.

Example

```text
API

↓

Timer Service

↓

Timeout

500 ms
```

If the deadline expires

↓

Return

```text
DEADLINE_EXCEEDED
```

Deadlines prevent requests from waiting forever.

---

# 9.11 Retries

Some failures are temporary.

Example

```text
Timer Service

↓

Temporary Network Error
```

Retry.

Permanent failures

```text
Validation Error
```

↓

Do NOT retry.

Recommended retryable errors

- UNAVAILABLE
- DEADLINE_EXCEEDED

Do not retry

- INVALID_ARGUMENT
- NOT_FOUND
- PERMISSION_DENIED

---

# 9.12 Streaming

gRPC supports four communication models.

---

## Unary

One request

↓

One response

Most scheduler operations use unary RPCs.

---

## Server Streaming

One request

↓

Many responses

Useful for

```text
Export Audit Logs
```

---

## Client Streaming

Many requests

↓

One response

Useful for

Bulk Job Upload

---

## Bidirectional Streaming

Many requests

↓

Many responses

Potential future use

Real-time monitoring

Current scheduler implementation primarily uses **Unary RPCs**.

---

# 9.13 Versioning

Proto files evolve carefully.

Bad

```proto
string job_id = 1;
```

↓

Change type

```proto
int32 job_id = 1;
```

This breaks compatibility.

Better

Add new field

```proto
string job_id = 1;

string tenant_id = 2;
```

Older clients continue working.

---

# 9.14 Security

Internal communication should be protected.

Version 1

Trusted Docker network.

Version 2

TLS

↓

mTLS

Every service authenticates every other service.

---

# 9.15 Observability

Every gRPC request includes:

- Trace ID
- Span ID
- Request ID

Example

```text
REST

↓

gRPC

↓

RabbitMQ

↓

Worker
```

One trace follows the request across all services.

Metrics include:

- latency
- request count
- error rate
- timeout count

---

# 9.16 NestJS Integration

NestJS provides built-in gRPC support.

Typical architecture

```text
Controller

↓

Service

↓

gRPC Client

↓

Remote Service
```

Each microservice acts as either:

- gRPC Server
- gRPC Client
- Both

Configuration includes:

- proto path
- package name
- service name
- host
- port

The generated protobuf classes become shared DTOs across all services.

---

# 9.17 Best Practices

Use one proto package per domain.

Keep messages small.

Avoid deeply nested structures.

Never expose database models directly.

Use enums instead of free-form strings where appropriate.

Always define deadlines.

Retry only transient failures.

Reserve removed field numbers.

Generate code automatically rather than writing DTOs manually.

Version APIs without breaking existing clients.

Document every RPC.

---

# 9.18 Example Communication Flow

Creating a delayed job:

```text
Client

↓

POST /jobs

↓

REST API

↓

CreateJob()

↓

Timer Service

↓

PostgreSQL

↓

CreateJobResponse

↓

REST Response
```

Recording execution:

```text
Worker

↓

RecordExecution()

↓

Audit Service

↓

Audit Stored
```

Acquiring scanner ownership:

```text
Scanner

↓

AcquireLease()

↓

Coordinator

↓

Redis

↓

Lease Granted
```

---

# 9.19 gRPC Service Matrix

| Service      | Exposes RPCs                            | Consumes RPCs              |
| ------------ | --------------------------------------- | -------------------------- |
| API          | None                                    | Timer                      |
| Timer        | CreateJob, UpdateJob, CancelJob, GetJob | Coordinator                |
| Scanner      | None                                    | Coordinator                |
| Worker       | None                                    | Timer, Audit, Notification |
| Coordinator  | Lease, Heartbeat                        | None                       |
| Audit        | RecordExecution                         | None                       |
| Notification | SendNotification                        | None                       |

---

# Chapter Summary

This chapter designed the internal communication layer of the Distributed Task Scheduler Platform using gRPC and Protocol Buffers. We explored why gRPC was selected over REST for service-to-service communication, how Protocol Buffers define stable service contracts, the organization of `.proto` files, message and service design, error handling, deadlines, retries, streaming models, versioning strategies, security considerations, observability, and NestJS integration. Together, these practices establish a strongly typed, efficient, and maintainable communication layer for all internal microservices.

---

# Next Chapter

**Chapter 10 — Internal Communication & Messaging Patterns**

The next chapter expands beyond synchronous gRPC calls and explains how all services communicate across the platform. It will cover synchronous versus asynchronous communication, RabbitMQ message flows, event-driven architecture, command and event messages, message schemas, delivery guarantees, acknowledgements, dead-letter queues, correlation IDs, trace propagation, and the communication patterns that connect the Timing Plane and Execution Plane.

# Filename

**`V3-C08-Protocol-Buffers-And-API-Contract-Design.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 8 — Protocol Buffers, API Contracts & Code Generation

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 8

**Filename:** `V3-C08-Protocol-Buffers-And-API-Contract-Design.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why API Contracts Matter
3. What is Protocol Buffers?
4. Why Protobuf Instead of JSON
5. Project Structure
6. Service Design
7. Message Design
8. Enum Design
9. Common Messages
10. Error Messages
11. Field Numbering
12. Optional Fields
13. Oneof
14. Nested Messages
15. Code Generation
16. Versioning
17. Backward Compatibility
18. Best Practices
19. Chapter Summary

---

# 8.1 Introduction

A microservice architecture succeeds or fails based on one thing:

**Communication Contracts**

Our services are independently deployed.

That means:

- Scheduler should not know Worker's implementation.
- Worker should not know Notification's implementation.
- Identity should evolve independently.

Instead, services agree on a **contract**.

That contract is defined using **Protocol Buffers (.proto files).**

---

# 8.2 Why API Contracts Matter

Imagine the Worker calling Scheduler.

Without contracts:

```text
Worker

↓

Random JSON

↓

Scheduler
```

Questions arise:

- Which fields exist?
- Which fields are required?
- Which types are expected?
- What does the response contain?

Every team interprets the API differently.

Instead:

```text
Worker

↓

scheduler.proto

↓

Scheduler
```

Both sides compile from the same contract.

---

# 8.3 What is Protocol Buffers?

Protocol Buffers (protobuf) is a language-neutral Interface Definition Language (IDL).

Think of it like this:

```text
.proto File

↓

Compiler

↓

TypeScript

Go

Java

Python

Rust

↓

Applications
```

One contract can generate code for many languages.

This makes polyglot microservices possible.

---

# 8.4 Why Protobuf Instead of JSON?

REST request:

```json
{
  "jobId": "123",
  "status": "RUNNING",
  "retry": 2
}
```

Everything is text.

gRPC:

```text
Binary

↓

Compact

↓

Serialized
```

Advantages:

- Smaller payload
- Faster serialization
- Strong typing
- Less bandwidth
- Less CPU
- Automatic code generation

---

# 8.5 Project Structure

All contracts live in one shared package.

```text
proto/

├── common.proto

├── scheduler.proto

├── worker.proto

├── notification.proto

├── identity.proto

├── monitoring.proto

├── config.proto

├── audit.proto

└── health.proto
```

Generated TypeScript code:

```text
packages/

protobuf/

├── scheduler/

├── worker/

├── notification/

├── identity/

├── monitoring/

└── common/
```

Applications never manually create DTOs for gRPC.

---

# 8.6 Service Design

Every service owns exactly one contract.

Example:

```text
Scheduler Service

↓

scheduler.proto
```

Contains:

- CreateJob
- GetJob
- CancelJob
- PauseSchedule
- ResumeSchedule
- RetryJob

Worker owns:

```text
worker.proto
```

Identity owns:

```text
identity.proto
```

No contract contains another service's RPC definitions.

---

# 8.7 Message Design

A message represents structured data.

Example:

```protobuf
message Job {

    string id = 1;

    string tenant_id = 2;

    string schedule_id = 3;

    JobStatus status = 4;

    int32 retry_count = 5;

    int64 execution_time = 6;
}
```

Think of a message as:

```text
TypeScript Interface

↓

Serialized Binary
```

---

# 8.8 Request & Response Messages

Never reuse entities directly.

Instead:

```protobuf
message CreateJobRequest {}

message CreateJobResponse {}

message GetJobRequest {}

message GetJobResponse {}
```

Benefits:

- Future flexibility
- Independent evolution
- Clear API boundaries

---

# 8.9 Enum Design

Enums replace string constants.

Instead of:

```text
RUNNING
```

Use:

```protobuf
enum JobStatus {

    JOB_STATUS_UNKNOWN = 0;

    JOB_STATUS_PENDING = 1;

    JOB_STATUS_RUNNING = 2;

    JOB_STATUS_COMPLETED = 3;

    JOB_STATUS_FAILED = 4;

    JOB_STATUS_RETRY = 5;

    JOB_STATUS_DLQ = 6;
}
```

Advantages:

- Strong typing
- Efficient serialization
- IDE autocomplete

---

# 8.10 Common Messages

Many services share identical structures.

Instead of duplicating:

```protobuf
message Tenant {}
```

Place them in:

```text
common.proto
```

Examples:

- Tenant
- Pagination
- Timestamp
- UUID
- TraceContext
- Metadata

All services import common definitions.

---

# 8.11 Error Messages

gRPC already provides status codes.

Sometimes business errors are required.

Example:

```protobuf
message ValidationError {

    string field = 1;

    string message = 2;
}
```

Another:

```protobuf
message BusinessError {

    string code = 1;

    string description = 2;
}
```

Avoid sending raw exception strings.

---

# 8.12 Field Numbering

Every field has a numeric identifier.

Example:

```protobuf
message Job {

    string id = 1;

    string tenant_id = 2;

    string title = 3;
}
```

Numbers matter more than field names.

Never change field numbers after release.

---

# 8.13 Reserved Fields

Suppose field 5 is removed.

Never reuse it.

Instead:

```protobuf
reserved 5;
```

or

```protobuf
reserved "retry_limit";
```

This prevents accidental compatibility issues.

---

# 8.14 Optional Fields

Older clients may not understand new fields.

Instead of making everything required:

```protobuf
optional string description = 7;
```

Older services ignore it.

Newer services use it.

This preserves compatibility.

---

# 8.15 Repeated Fields

Lists are represented with `repeated`.

Example:

```protobuf
message JobList {

    repeated Job jobs = 1;
}
```

Equivalent TypeScript:

```typescript
jobs: Job[]
```

---

# 8.16 Oneof

Sometimes only one value may exist.

Example:

```protobuf
message NotificationTarget {

    oneof target {

        Email email = 1;

        Sms sms = 2;

        Webhook webhook = 3;
    }
}
```

Only one field may be populated.

This prevents invalid states.

---

# 8.17 Nested Messages

Complex structures may contain nested messages.

Example:

```protobuf
message Job {

    Metadata metadata = 1;

    RetryPolicy retry = 2;

    Schedule schedule = 3;
}
```

This improves organization without creating multiple RPC calls.

---

# 8.18 Code Generation

Workflow:

```text
.proto Files

↓

protoc

↓

Generated TypeScript

↓

NestJS Service

↓

Application
```

Developers never manually write protobuf DTOs.

Generated code becomes the single source of truth.

---

# 8.19 Generated Project Structure

```text
packages/protobuf/

├── generated/

│   ├── scheduler/

│   ├── worker/

│   ├── identity/

│   ├── notification/

│   ├── monitoring/

│   └── common/

├── proto/

└── scripts/
```

Applications import only generated types.

---

# 8.20 Contract Evolution

Version 1:

```protobuf
message Job {

    string id = 1;

    string title = 2;
}
```

Later:

```protobuf
message Job {

    string id = 1;

    string title = 2;

    optional string description = 3;
}
```

Old clients continue functioning.

---

# 8.21 Backward Compatibility Rules

Allowed:

- Add optional fields
- Add enum values
- Add new RPC methods
- Add new messages

Forbidden:

- Remove field numbers
- Change field types
- Reuse reserved numbers
- Rename RPC methods without versioning

These rules prevent breaking deployed services.

---

# 8.22 Scheduler Contract Example

```text
scheduler.proto

↓

SchedulerService

↓

RPCs

    CreateJob()

    CancelJob()

    PauseSchedule()

    ResumeSchedule()

    RetryJob()

    GetJob()

    GetJobs()

    ClaimBucket()

    CompleteJob()
```

The `.proto` file becomes the public API of the Scheduler Service.

---

# 8.23 Complete Contract Architecture

```text
                    proto/

        ┌───────────┼────────────┐

        ▼           ▼            ▼

 scheduler    identity    notification

        │           │            │

        └───────────┼────────────┘

                    ▼

             Code Generator

                    ▼

         Generated TypeScript SDK

                    ▼

             NestJS Applications
```

Every service compiles against the same generated contracts.

---

# 8.24 Future Evolution

Current:

```text
Protocol Buffers
```

↓

Future:

```text
Buf
```

↓

```text
Schema Registry
```

↓

```text
Automated Compatibility Checks
```

↓

```text
Public SDK Generation
```

↓

```text
Multi-language Client Libraries
```

The contract layer grows independently of service implementations.

---

# 8.25 Best Practices

- One `.proto` file per service.
- Keep contracts small and focused.
- Never expose database entities directly.
- Use request and response messages.
- Start enum values at `0` with an `UNKNOWN` value.
- Never change field numbers after release.
- Reserve removed fields.
- Add new fields as optional.
- Share common structures through `common.proto`.
- Generate code automatically; never edit generated files.

---

# Chapter Summary

This chapter designed the Protocol Buffer contracts that define communication between every microservice in the scheduler platform. We explored messages, enums, request/response patterns, field numbering, optional fields, `oneof`, nested messages, code generation, backward compatibility, and contract evolution. These protobuf definitions become the single source of truth for all internal APIs, ensuring strongly typed, efficient, and version-safe communication across the entire NestJS microservice ecosystem.

---

# Next Chapter

**Filename:** `V3-C09-gRPC-Implementation-In-NestJS.md`

**Chapter 9 — Implementing gRPC Servers & Clients in NestJS**

The next chapter will move from contract design to actual implementation. It will cover configuring NestJS as a gRPC server, registering protobuf packages, creating gRPC controllers, building reusable client factories, dependency injection, interceptors, metadata propagation, deadlines, authentication middleware, health checks, and establishing end-to-end communication between services using the contracts designed in this chapter.

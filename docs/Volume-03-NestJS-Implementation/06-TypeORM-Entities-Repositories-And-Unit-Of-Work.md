# Filename

**`V3-C06-TypeORM-Entities-Repositories-And-Unit-Of-Work.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 6 — TypeORM Entities, Repositories & Unit of Work Pattern

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 6

**Filename:** `V3-C06-TypeORM-Entities-Repositories-And-Unit-Of-Work.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why This Layer Exists
3. Domain Model vs Entity
4. Entity Design Principles
5. Entity Organization
6. Repository Pattern
7. Custom Repositories
8. Service Layer
9. Unit of Work Pattern
10. Transactions
11. Optimistic Locking
12. Pessimistic Locking
13. Entity Lifecycle Hooks
14. Soft Deletes
15. QueryBuilder
16. Performance Considerations
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 6.1 Introduction

The database stores data.

Business logic manipulates data.

Something must connect both.

That layer consists of:

```text
Controller

↓

Service

↓

Repository

↓

Entity

↓

Database
```

Understanding these layers is essential because almost every request in the scheduler flows through them.

---

# 6.2 Why This Layer Exists

Suppose an API request creates a job.

A beginner architecture:

```text
Controller

↓

SQL
```

Problems:

- SQL duplicated
- No abstraction
- Difficult testing
- Business logic mixed with persistence

Instead:

```text
Controller

↓

Service

↓

Repository

↓

Entity

↓

Database
```

Each layer has one responsibility.

---

# 6.3 What is an Entity?

An Entity represents one database table.

Example:

Database:

```text
scheduler.jobs
```

TypeORM:

```typescript
JobEntity;
```

The entity maps database columns to TypeScript properties.

Think of it as:

```text
Database Row

↓

TypeScript Object
```

One row becomes one object.

---

# 6.4 Entity Responsibilities

An entity should contain:

- Column definitions
- Relationships
- Default values
- Simple helper methods
- Validation that belongs to the entity itself

It should **not** contain:

- Business workflows
- API calls
- RabbitMQ publishing
- Redis logic
- Notification sending

Entities describe data.

They do not orchestrate the application.

---

# 6.5 Entity Organization

Following the schemas designed in Volume 2:

```text
packages/database/

entities/

├── identity/

│   ├── tenant.entity.ts

│   ├── user.entity.ts

│   └── role.entity.ts

│

├── scheduler/

│   ├── schedule.entity.ts

│   ├── job.entity.ts

│   ├── execution-history.entity.ts

│   ├── retry-history.entity.ts

│   ├── dispatch-history.entity.ts

│   └── dlq.entity.ts

│

├── notification/

├── audit/

├── config/

└── monitoring/
```

Folder organization mirrors PostgreSQL schemas.

---

# 6.6 Entity Relationships

Entities reference each other.

Example:

```text
Tenant

↓

Jobs
```

One tenant owns many jobs.

Relationship:

```text
TenantEntity

1

↓

*

JobEntity
```

Another:

```text
Job

↓

Execution History
```

One job produces many execution records.

---

# 6.7 Repository Pattern

Repositories encapsulate database operations.

Without repositories:

```text
Service

↓

SQL
```

Every service writes SQL.

Instead:

```text
Service

↓

Repository

↓

Database
```

The repository becomes the only persistence layer.

---

# 6.8 Repository Responsibilities

A repository performs operations such as:

```text
Create

Read

Update

Delete

Pagination

Search

Filtering

Locking

Transactions
```

It should not:

- Validate JWTs
- Send emails
- Publish RabbitMQ messages
- Apply business rules

Repositories only manipulate persistence.

---

# 6.9 Repository Organization

```text
repositories/

├── scheduler/

│   ├── job.repository.ts

│   ├── execution.repository.ts

│   ├── retry.repository.ts

│   └── schedule.repository.ts

│

├── identity/

├── notification/

├── monitoring/

└── audit/
```

One repository per aggregate root.

---

# 6.10 Service Layer

Services coordinate repositories.

Example:

```text
Create Job

↓

Validate Request

↓

Save Job

↓

Create Audit Event

↓

Publish Domain Event

↓

Return Response
```

Repositories perform persistence.

Services perform orchestration.

---

# 6.11 Example Flow

Creating a schedule:

```text
REST Request

↓

ScheduleController

↓

ScheduleService

↓

ScheduleRepository

↓

PostgreSQL
```

If recurring:

```text
ScheduleService

↓

Cron Expander

↓

JobRepository

↓

Database
```

One request may involve multiple repositories.

---

# 6.12 Unit of Work

Suppose execution succeeds.

We must:

- Update Job
- Insert Execution History
- Update Metrics
- Insert Audit Record
- Publish Domain Event

Failure midway would corrupt data.

Instead:

```text
Begin Transaction

↓

Job Repository

↓

Execution Repository

↓

Audit Repository

↓

Commit
```

Everything succeeds together.

---

# 6.13 Why Unit of Work?

Imagine:

```text
Update Job

↓

Success
```

Then:

```text
Insert History

↓

Failure
```

Result:

Job completed.

History missing.

Database becomes inconsistent.

Instead:

```text
Transaction

↓

Everything

↓

Commit
```

or

```text
Everything

↓

Rollback
```

Atomic execution.

---

# 6.14 Transaction Boundaries

Small transactions:

```text
Update Job
```

Good.

Huge transactions:

```text
Update Job

↓

Send Email

↓

RabbitMQ

↓

Redis

↓

HTTP Call

↓

Commit
```

Bad.

External systems should never participate in database transactions.

---

# 6.15 Optimistic Locking

Used when conflicts are rare.

Entity contains:

```text
Version

1
```

Update:

```text
Version

2
```

Another update:

```text
Expected Version

1
```

Database:

```text
Current Version

2
```

Conflict detected.

No overwrite occurs.

---

# 6.16 Pessimistic Locking

Used when concurrent modification is dangerous.

Workflow:

```text
Transaction

↓

Lock Row

↓

Modify

↓

Commit

↓

Unlock
```

Scheduler example:

```text
Acquire Job

↓

FOR UPDATE SKIP LOCKED
```

Only one worker receives the job.

---

# 6.17 Scheduler Locking Strategy

Scanner:

```text
Read Bucket

↓

FOR UPDATE SKIP LOCKED
```

Dispatcher:

```text
Claim Jobs

↓

Lock

↓

Publish
```

Workers:

```text
Update Job

↓

Lock Row
```

These locks prevent duplicate execution.

---

# 6.18 Entity Lifecycle Hooks

TypeORM supports lifecycle events.

Example:

```text
Before Insert
```

↓

Generate UUID.

Example:

```text
After Insert
```

↓

Log creation.

Hooks should remain lightweight.

Do not:

- Publish RabbitMQ
- Call Redis
- Make HTTP requests

Use hooks only for entity-related tasks.

---

# 6.19 Soft Deletes

Some records should not disappear.

Instead of:

```text
DELETE
```

Use:

```text
deleted_at

↓

Timestamp
```

Row remains.

Applications ignore deleted rows.

Useful for:

- schedules
- templates
- users

Not recommended for:

- execution history
- audit logs

Historical records should remain immutable.

---

# 6.20 QueryBuilder

Simple query:

```text
findById()
```

Complex scheduler query:

```text
Jobs

↓

Status

↓

Execution Time

↓

Tenant

↓

Retry Count

↓

FOR UPDATE SKIP LOCKED
```

QueryBuilder handles advanced SQL while remaining type-safe.

---

# 6.21 Performance Considerations

Avoid:

```text
Load Entire Table
```

Instead:

```text
Pagination

↓

Indexes

↓

Selective Columns
```

Use projections.

Avoid loading relationships unnecessarily.

Lazy loading is generally discouraged in backend services due to hidden queries.

---

# 6.22 Repository Dependencies

Repositories depend on:

```text
Entity

↓

DataSource

↓

Transaction Manager

↓

Logger
```

Repositories should not depend on:

- Controllers
- RabbitMQ
- Redis
- HTTP clients

Keep dependencies minimal.

---

# 6.23 Complete Architecture

```text
REST

↓

Controller

↓

Service

↓

Unit Of Work

↓

Repositories

↓

Entities

↓

TypeORM

↓

PostgreSQL
```

Each layer has one clear responsibility.

---

# 6.24 Scheduler Example

Executing a job:

```text
Worker

↓

JobService

↓

Transaction

↓

JobRepository

↓

ExecutionRepository

↓

RetryRepository

↓

AuditRepository

↓

Commit

↓

RabbitMQ ACK
```

Notice that the RabbitMQ acknowledgment happens **after** the database transaction succeeds.

This prevents message loss and inconsistent state.

---

# 6.25 Future Evolution

Current:

```text
Repositories
```

↓

Later:

```text
CQRS
```

↓

```text
Read Model
```

↓

```text
Event Store
```

↓

```text
Event Sourcing
```

The repository abstraction allows these architectural changes with minimal impact on controllers and services.

---

# 6.26 Best Practices

- Keep entities focused on persistence mapping.
- Place business logic in services, not entities.
- Use repositories for all database access.
- Wrap multi-table updates in transactions.
- Keep transactions short.
- Use optimistic locking where conflicts are rare.
- Use pessimistic locking for scheduler coordination.
- Keep entity hooks lightweight.
- Prefer soft deletes for business entities.
- Use QueryBuilder for complex scheduler queries.

---

# Chapter Summary

This chapter designed the persistence layer of the Distributed Task Scheduler Platform. We defined the responsibilities of entities, repositories, services, and the Unit of Work pattern, explored transaction boundaries, optimistic and pessimistic locking, lifecycle hooks, soft deletes, and QueryBuilder usage. Together, these patterns provide a clean separation between business logic and persistence while ensuring data consistency, concurrency safety, and maintainability across every NestJS microservice.

---

# Next Chapter

**Filename:** `V3-C07-gRPC-Architecture-And-Service-Communication.md`

**Chapter 7 — gRPC Architecture & Inter-Service Communication**

The next chapter will move beyond persistence and begin implementing communication between microservices. It will cover Protocol Buffers, gRPC server and client setup in NestJS, service discovery, deadlines, retries, metadata propagation, authentication, streaming, error handling, versioning, and how every scheduler service communicates efficiently without HTTP.

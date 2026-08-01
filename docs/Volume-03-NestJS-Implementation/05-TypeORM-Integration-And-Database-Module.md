# Filename

**`V3-C05-TypeORM-Integration-And-Database-Module.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 5 — Building the Shared Database Module with TypeORM

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 5

**Filename:** `V3-C05-TypeORM-Integration-And-Database-Module.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why a Shared Database Module?
3. Database Architecture
4. Why TypeORM?
5. Project Structure
6. DataSource Design
7. DatabaseModule
8. Entity Organization
9. Repository Pattern
10. Transactions
11. Connection Pooling
12. Migrations
13. Health Checks
14. Readiness & Liveness
15. Multi-Tenant Support
16. Performance Considerations
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 5.1 Introduction

Every service in our scheduler communicates with PostgreSQL.

Examples:

- Scheduler Service
- Identity Service
- Notification Service
- Audit Service
- Configuration Service
- Monitoring Service

Without a shared database architecture, every service would configure PostgreSQL independently.

Example:

```text
Scheduler

↓

TypeORM Config
```

Worker:

```text
Worker

↓

TypeORM Config
```

Notification:

```text
Notification

↓

TypeORM Config
```

Soon every service behaves slightly differently.

Instead we create one reusable **Database Module**.

---

# 5.2 Why a Shared Database Module?

A beginner project often looks like:

```typescript
TypeOrmModule.forRoot({
  host: process.env.DB_HOST,
  port: 5432,
});
```

inside every application.

Problems:

- duplicated configuration
- inconsistent connection pools
- inconsistent logging
- inconsistent retry policy
- difficult upgrades

Instead:

```text
Database Module

↓

Shared Configuration

↓

All Services
```

One implementation.

Many consumers.

---

# 5.3 Overall Architecture

```text
                 PostgreSQL

                      ▲

        ┌─────────────┼─────────────┐

        │             │             │

        ▼             ▼             ▼

 Scheduler      Notification     Identity

        │             │             │

        └─────────────┼─────────────┘

                      ▼

             DatabaseModule

                      ▼

                 TypeORM
```

Every service imports exactly the same module.

---

# 5.4 Why TypeORM?

NestJS supports multiple ORMs.

Options:

- Prisma
- Sequelize
- MikroORM
- TypeORM

We choose **TypeORM**.

Reasons:

- Excellent NestJS integration
- Mature ecosystem
- Decorator-based entities
- Transaction support
- QueryBuilder
- Repository pattern
- Migration support
- PostgreSQL features
- Familiar to enterprise developers

It also supports advanced PostgreSQL functionality needed later.

---

# 5.5 Project Structure

The shared database library:

```text
packages/

database/

├── src/

│   ├── datasource/

│   ├── config/

│   ├── entities/

│   ├── repositories/

│   ├── migrations/

│   ├── subscribers/

│   ├── transactions/

│   ├── health/

│   ├── decorators/

│   ├── interfaces/

│   ├── constants/

│   ├── utils/

│   └── database.module.ts

└── package.json
```

Everything database-related belongs here.

---

# 5.6 DataSource

TypeORM revolves around one object.

```text
DataSource
```

Think of it as:

```text
Application

↓

Database Connection

↓

Repositories

↓

Entities

↓

Transactions
```

Every service creates one DataSource instance.

---

# 5.7 Database Configuration

Configuration originates from:

```text
Environment

↓

ConfigModule

↓

Database Config

↓

DataSource
```

Example:

```text
DB_HOST

↓

DatabaseConfig

↓

TypeORM
```

No environment variables are accessed directly.

---

# 5.8 DatabaseModule

Every service imports:

```typescript
DatabaseModule;
```

Instead of:

```typescript
TypeOrmModule.forRoot(...)
```

internally, the DatabaseModule performs:

```text
Configuration

↓

DataSource

↓

Entities

↓

Repositories

↓

Health Checks

↓

Dependency Injection
```

Applications only import the module.

---

# 5.9 Entity Organization

Entities are grouped by schema.

```text
entities/

├── identity/

│   ├── tenant.entity.ts

│   ├── user.entity.ts

│   └── role.entity.ts

│

├── scheduler/

│   ├── job.entity.ts

│   ├── schedule.entity.ts

│   ├── execution.entity.ts

│   └── retry.entity.ts

│

├── notification/

│   ├── notification.entity.ts

│   └── template.entity.ts

│

├── audit/

├── monitoring/

└── config/
```

This mirrors our PostgreSQL schemas from Volume 2.

---

# 5.10 Repository Pattern

Business logic should not directly manipulate repositories.

Bad:

```text
Controller

↓

Repository
```

Better:

```text
Controller

↓

Service

↓

Repository

↓

Database
```

Repositories perform persistence.

Services perform business logic.

---

# 5.11 Repository Organization

```text
repositories/

├── scheduler/

│   ├── job.repository.ts

│   ├── execution.repository.ts

│   └── retry.repository.ts

│

├── identity/

├── notification/

├── monitoring/

└── audit/
```

Repositories belong to the domain that owns the data.

---

# 5.12 Transactions

Many scheduler operations update multiple tables.

Example:

Job execution:

```text
Job

↓

Execution History

↓

Retry History

↓

Audit Event
```

Either:

Everything succeeds.

or

Everything rolls back.

Workflow:

```text
Begin Transaction

↓

Update Job

↓

Insert History

↓

Insert Audit

↓

Commit
```

Failure:

```text
Rollback
```

Atomicity is essential.

---

# 5.13 Transaction Manager

Instead of every service implementing transactions differently:

```text
TransactionManager

↓

Begin

↓

Execute

↓

Commit

↓

Rollback
```

Shared implementation.

Consistent behavior.

---

# 5.14 Connection Pooling

Opening one PostgreSQL connection per request is inefficient.

Instead:

```text
Application

↓

Connection Pool

↓

20 Connections

↓

PostgreSQL
```

Workers reuse existing connections.

Benefits:

- lower latency
- reduced CPU
- fewer TCP handshakes

---

# 5.15 Pool Sizing

Example:

```text
API Gateway

↓

20 Connections
```

Scheduler:

```text
10 Connections
```

Worker:

```text
50 Connections
```

Monitoring:

```text
5 Connections
```

Each service receives an appropriate pool size.

---

# 5.16 Migrations

Schema changes are version-controlled.

Directory:

```text
migrations/

├── 001-create-schemas.ts

├── 002-create-enums.ts

├── 003-identity.ts

├── 004-scheduler.ts

├── 005-notification.ts

├── 006-audit.ts
```

Every migration is immutable.

Never edit an applied migration.

---

# 5.17 Migration Workflow

Developer:

```text
Entity Change

↓

Generate Migration

↓

Review

↓

Commit

↓

CI

↓

Apply Migration
```

Production:

```text
Migration

↓

Database

↓

Application Starts
```

The database always evolves before application code depends on new columns.

---

# 5.18 Subscribers

TypeORM Subscribers observe entity lifecycle events.

Example:

```text
Insert Job

↓

Subscriber

↓

Audit Log
```

Another:

```text
Delete Schedule

↓

Subscriber

↓

Domain Event
```

Subscribers should remain lightweight.

Heavy processing belongs in services.

---

# 5.19 Health Checks

Every service exposes:

```text
/health
```

The database module performs:

```text
Ping PostgreSQL

↓

Healthy?

↓

YES

↓

UP
```

Otherwise:

```text
DOWN
```

Kubernetes uses this endpoint.

---

# 5.20 Readiness vs Liveness

Liveness:

```text
Process Alive?
```

Readiness:

```text
Ready to Serve Requests?
```

Database unavailable?

```text
Application

↓

Running

↓

Not Ready
```

Kubernetes stops routing traffic until readiness succeeds.

---

# 5.21 Multi-Tenant Support

Every repository automatically filters by tenant.

Instead of:

```sql
SELECT *
FROM jobs;
```

Repositories generate:

```sql
SELECT *
FROM jobs
WHERE tenant_id = :tenantId;
```

Tenant isolation is enforced consistently.

---

# 5.22 Query Builder

Simple queries:

```text
Repository

↓

find()
```

Complex scheduler queries:

```text
QueryBuilder

↓

JOIN

↓

WHERE

↓

FOR UPDATE SKIP LOCKED

↓

ORDER BY
```

QueryBuilder is used where SQL complexity increases.

---

# 5.23 Database Module Dependencies

```text
DatabaseModule

├── ConfigModule

├── LoggerModule

├── TelemetryModule

└── HealthModule
```

The module integrates with other shared infrastructure libraries.

---

# 5.24 Complete Architecture

```text
Environment

      │

      ▼

ConfigModule

      ▼

DatabaseModule

      │

 ┌────┼──────────────────────────────┐

 ▼    ▼        ▼         ▼          ▼

Entities

Repositories

Transactions

Subscribers

Health Checks

      │

      ▼

PostgreSQL
```

Every service uses this exact architecture.

---

# 5.25 Future Evolution

Current:

```text
Single DataSource
```

↓

Future:

```text
Read Replica Routing
```

↓

```text
Connection Load Balancing
```

↓

```text
Sharding
```

↓

```text
Distributed PostgreSQL
```

The DatabaseModule evolves without affecting application code.

---

# 5.26 Best Practices

- Use one shared DatabaseModule.
- Keep entities grouped by schema.
- Separate repositories from business services.
- Wrap multi-table operations in transactions.
- Use connection pools.
- Keep migrations immutable.
- Use QueryBuilder for complex queries.
- Implement lightweight subscribers.
- Expose health checks.
- Enforce tenant isolation inside repositories.

---

# Chapter Summary

This chapter designed the shared database infrastructure for the Distributed Task Scheduler Platform. We introduced a reusable DatabaseModule built on TypeORM, organized entities and repositories by domain, implemented transaction management, connection pooling, migrations, subscribers, health checks, and tenant-aware repositories. By centralizing database infrastructure, every NestJS microservice gains consistent persistence behavior while remaining independent and maintainable.

---

# Next Chapter

**Filename:** `V3-C06-TypeORM-Entities-Repositories-And-Unit-Of-Work.md`

**Chapter 6 — Entities, Repositories & Unit of Work Pattern**

The next chapter will dive deeply into how entities should be designed, how repositories encapsulate persistence logic, how the Unit of Work pattern coordinates transactions across multiple repositories, entity lifecycle hooks, custom repositories, optimistic/pessimistic locking, and how these patterns fit into the scheduler's architecture.

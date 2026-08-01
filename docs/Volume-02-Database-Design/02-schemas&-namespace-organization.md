# Volume 2 — Database Design

# Chapter 2 — Database Schemas & Namespace Organization

**Document:** Distributed Task Scheduler Platform
**Volume:** 2 — Database Design
**Chapter:** 2
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Use Multiple Schemas?
3. Database Layout
4. Scheduler Schema
5. Audit Schema
6. Notification Schema
7. Configuration Schema
8. Identity Schema
9. Metrics Schema
10. Future Schemas
11. Cross-Schema Relationships
12. Security & Permissions
13. Backup Strategy
14. Best Practices
15. Chapter Summary

---

# 2.1 Introduction

As the scheduler grows, it will contain dozens of tables.

Examples include:

- jobs
- recurring schedules
- retries
- idempotency
- notifications
- audit history
- tenants
- users
- API keys
- execution history
- dead-letter queues
- configuration

If every table is placed inside PostgreSQL's default `public` schema, the database quickly becomes difficult to maintain.

Instead, we organize the database into **logical schemas**.

Think of a schema as a folder inside a filesystem.

Instead of:

```text
Database

jobs
users
notifications
audit
config
retry
leases
```

we organize them as:

```text
Database

scheduler/
audit/
notification/
identity/
config/
metrics/
```

This improves maintainability, security, and future scalability.

---

# 2.2 What is a PostgreSQL Schema?

A PostgreSQL database contains one or more **schemas**.

A schema is a namespace that groups related database objects.

Example:

```text
Database

├── scheduler
│      jobs
│      schedules
│
├── audit
│      audit_events
│
├── notification
│      deliveries
│
└── identity
       users
```

Tables with the same name may even exist in different schemas.

Example:

```sql
scheduler.jobs

audit.jobs
```

Although we generally avoid duplicate names, PostgreSQL allows this because the schema is part of the object's fully qualified name.

---

# 2.3 Why Use Multiple Schemas?

Without schemas:

```text
public

jobs
schedules
audit_events
users
roles
permissions
notifications
delivery_attempts
retry_history
execution_history
metrics
configuration
```

As the project grows, everything becomes mixed together.

With schemas:

```text
scheduler.jobs

scheduler.schedules

audit.audit_events

identity.users

notification.deliveries
```

Benefits:

- Better organization
- Easier maintenance
- Clear ownership
- Improved permissions
- Simpler backups
- Cleaner migrations
- Better developer experience

---

# 2.4 Complete Database Layout

The database will eventually look like:

```text
distributed_scheduler

├── scheduler
│
├── audit
│
├── notification
│
├── identity
│
├── config
│
└── metrics
```

Each schema belongs primarily to one logical service.

| Schema       | Primary Owner        |
| ------------ | -------------------- |
| scheduler    | Timer Service        |
| audit        | Audit Service        |
| notification | Notification Service |
| identity     | API Gateway          |
| config       | Platform             |
| metrics      | Monitoring           |

This ownership is logical rather than exclusive—other services may read data where appropriate.

---

# 2.5 Scheduler Schema

The `scheduler` schema stores the platform's core business entities.

Example:

```text
scheduler

jobs

recurring_schedules

execution_history

retry_history

dead_letter_jobs

idempotency_keys

time_buckets

bucket_leases

dispatch_history
```

This is the largest schema in the system.

Almost every request interacts with it.

---

## Why Separate It?

The scheduler schema contains the data required to execute jobs.

It does **not** contain:

- users
- notifications
- audit logs

This keeps the execution engine independent from other concerns.

---

# 2.6 Scheduler Schema Responsibilities

Stores:

- Scheduled jobs
- Recurring schedules
- Retry metadata
- Execution history
- Dispatch history
- Worker metadata
- Bucket ownership metadata
- Dead-letter records
- Idempotency records

Everything required for scheduling lives here.

---

# 2.7 Audit Schema

Audit records never participate in scheduling.

Instead they answer questions like:

- Who created this job?
- Who deleted the schedule?
- Which worker executed it?
- When was it retried?

Structure:

```text
audit

audit_events

audit_exports

audit_archives
```

Audit data is append-only.

No updates.

No deletes (until archival).

---

# 2.8 Notification Schema

Stores notification-specific information.

```text
notification

templates

delivery_attempts

subscriptions

webhook_history

email_history

sms_history
```

Notice that **jobs themselves are NOT stored here**.

Only communication history.

---

# 2.9 Identity Schema

Identity is separated from scheduling.

Contains:

```text
identity

users

roles

permissions

tenants

api_keys

refresh_tokens
```

The scheduler references users through IDs.

It does not duplicate authentication data.

---

## Why Separate Identity?

Because identity changes independently.

Authentication evolves separately from scheduling.

This separation follows Domain Driven Design (DDD).

---

# 2.10 Configuration Schema

Stores runtime configuration.

Example:

```text
config

system_settings

retry_policies

feature_flags

worker_limits

scheduler_settings
```

Instead of hardcoding values:

```typescript
const MAX_RETRIES = 5;
```

Store them:

```text
config.retry_policies
```

The application can reload configuration without recompilation.

---

# 2.11 Metrics Schema

Operational metrics that must persist.

Example:

```text
metrics

daily_statistics

monthly_usage

tenant_usage

scheduler_reports
```

This schema is **not** Prometheus.

Prometheus stores time-series metrics externally.

The metrics schema stores business reports.

---

# 2.12 Future Schemas

Future enterprise deployments may introduce additional schemas.

Examples:

```text
billing

quotas

analytics

machine_learning

workflow

plugins
```

Because schemas are independent namespaces, expansion becomes straightforward.

---

# 2.13 Cross-Schema Relationships

Relationships between schemas remain explicit.

Example:

```text
identity.users
        │
        │ user_id
        ▼
scheduler.jobs
        │
        │ job_id
        ▼
audit.audit_events
        │
        ▼
notification.delivery_attempts
```

Every table references another using fully qualified names.

Example:

```sql
REFERENCES identity.users(id)
```

---

# 2.14 Naming Convention

Always use fully qualified names inside migrations.

Example:

```sql
scheduler.jobs
```

instead of

```sql
jobs
```

Benefits:

- Explicit ownership
- No ambiguity
- Easier maintenance
- Cleaner migrations

---

# 2.15 Security & Permissions

Schemas simplify security.

Example:

API Service:

```text
Read

scheduler

identity

config
```

Worker:

```text
Read

scheduler

Write

execution_history
```

Audit Service:

```text
Write

audit
```

Notification Service:

```text
Read

scheduler

Write

notification
```

Every service receives only the permissions it needs.

This follows the Principle of Least Privilege.

---

# 2.16 Backup Strategy

Schemas also simplify backups.

Examples:

Entire database:

```bash
pg_dump distributed_scheduler
```

Only audit:

```bash
pg_dump --schema=audit
```

Only scheduler:

```bash
pg_dump --schema=scheduler
```

Large audit archives may even be backed up independently.

---

# 2.17 Schema Evolution

As the platform evolves:

```text
Phase 1

scheduler

↓

Phase 2

scheduler
audit

↓

Phase 3

scheduler
audit
notification

↓

Phase 4

scheduler
audit
notification
identity

↓

Phase 5

Additional enterprise schemas
```

No application redesign is required.

---

# 2.18 Best Practices

The database follows these organizational principles:

- Group tables by business domain.
- Never overload the `public` schema.
- Keep scheduling isolated from authentication.
- Separate audit data from operational data.
- Separate notification history from execution history.
- Use fully qualified table names in migrations.
- Grant permissions at the schema level.
- Keep schemas cohesive.
- Allow future expansion without breaking existing services.
- Document ownership for every schema.

---

# 2.19 Proposed Final Database Structure

```text
distributed_scheduler

├── scheduler
│   ├── jobs
│   ├── recurring_schedules
│   ├── execution_history
│   ├── retry_history
│   ├── dispatch_history
│   ├── dead_letter_jobs
│   ├── idempotency_keys
│   ├── time_buckets
│   └── bucket_leases
│
├── audit
│   ├── audit_events
│   └── audit_archive
│
├── notification
│   ├── templates
│   ├── delivery_attempts
│   ├── webhook_history
│   └── subscriptions
│
├── identity
│   ├── users
│   ├── tenants
│   ├── roles
│   ├── permissions
│   └── api_keys
│
├── config
│   ├── system_settings
│   ├── retry_policies
│   └── feature_flags
│
└── metrics
    ├── daily_usage
    └── tenant_reports
```

---

# Chapter Summary

This chapter designed the logical organization of the PostgreSQL database using schemas. We explored why a single `public` schema is insufficient for a production-grade scheduler, introduced separate namespaces for scheduling, auditing, notifications, identity, configuration, and business metrics, discussed schema ownership, cross-schema relationships, permissions, backup strategies, and future expansion. This organization provides a modular foundation that keeps business domains isolated while allowing the database to scale in complexity without becoming difficult to maintain.

---

# Next Chapter

**Chapter 3 — Naming Standards & Database Conventions**

The next chapter will define the standards used across the entire database: table names, column names, UUID strategy, timestamp conventions, enum design, foreign keys, constraints, index naming, trigger naming, migration conventions, and SQL style guidelines. These conventions will ensure that every table designed in later chapters follows a consistent, production-quality standard.

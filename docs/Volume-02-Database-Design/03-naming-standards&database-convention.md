# Volume 2 — Database Design

# Chapter 3 — Naming Standards & Database Conventions

**Document:** Distributed Task Scheduler Platform
**Volume:** 2 — Database Design
**Chapter:** 3
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Naming Standards Matter
3. General Naming Principles
4. Database Naming Conventions
5. Table Naming
6. Column Naming
7. Primary Keys
8. UUID Strategy
9. Foreign Keys
10. Timestamp Standards
11. Status & Enum Conventions
12. Constraints
13. Index Naming
14. Trigger Naming
15. Function Naming
16. Sequence Naming
17. SQL Style Guide
18. Migration Standards
19. Future Evolution
20. Best Practices
21. Chapter Summary

---

# 3.1 Introduction

A production database is not just a collection of tables—it is a long-lived system that multiple engineers will maintain over many years.

As the Distributed Task Scheduler Platform grows, it will eventually contain:

- 40–70 tables
- Hundreds of columns
- Hundreds of indexes
- Dozens of constraints
- Multiple schemas
- Thousands of SQL queries

Without consistent conventions, the schema becomes difficult to understand and maintain.

This chapter establishes the standards that every future table, column, index, and migration in this project will follow.

---

# 3.2 Why Naming Standards Matter

Imagine two engineers designing tables independently.

Engineer A creates:

```sql
Jobs
```

Engineer B creates:

```sql
jobTable
```

Engineer C creates:

```sql
tbl_jobs
```

Although they represent the same concept, the inconsistency creates confusion.

Instead, the platform adopts one convention:

```sql
jobs
```

Consistency is more valuable than personal preference.

---

# 3.3 General Naming Principles

Every database object should be:

- Descriptive
- Predictable
- Consistent
- Short but meaningful
- Lowercase
- Snake_case

Avoid:

```text
CamelCase

PascalCase

UPPERCASE

Hungarian notation

Abbreviations
```

Good:

```text
execution_history
```

Bad:

```text
ExecHistTbl
```

---

# 3.4 Database Naming Convention

Everything uses:

```text
lowercase

snake_case
```

Examples:

Good:

```text
jobs

retry_history

worker_execution

notification_templates
```

Bad:

```text
Jobs

RetryHistory

workerExecution

tblNotification
```

---

# 3.5 Schema Naming

Schemas represent business domains.

Examples:

```text
scheduler

audit

notification

identity

config

metrics
```

Schema names should always be singular nouns representing the domain.

---

# 3.6 Table Naming

Tables represent collections.

Therefore table names are plural.

Good:

```text
jobs

users

roles

permissions

retry_history

delivery_attempts
```

Avoid:

```text
job

tbl_job

job_table

scheduler_job
```

The schema already identifies the domain.

---

## Examples

```sql
scheduler.jobs

audit.audit_events

notification.delivery_attempts

identity.users
```

---

# 3.7 Column Naming

Columns use:

```text
snake_case
```

Examples:

```text
created_at

updated_at

execute_at

tenant_id

worker_id

retry_count

next_retry_at
```

Avoid:

```text
CreatedAt

ExecuteTime

WorkerID

retryCount
```

---

# 3.8 Primary Keys

Every table uses:

```text
id
```

Example:

```sql
id UUID PRIMARY KEY
```

Never:

```text
job_id
```

inside the jobs table.

Because:

```text
jobs.id
```

is already unambiguous.

---

## Why?

Consistent joins.

Example:

```sql
SELECT *
FROM scheduler.jobs j
JOIN scheduler.execution_history e
ON e.job_id = j.id;
```

Notice:

Referenced table:

```text
jobs.id
```

Referencing table:

```text
job_id
```

---

# 3.9 UUID Strategy

Every primary key uses UUID.

Example:

```sql
id UUID PRIMARY KEY
```

Advantages:

- Globally unique
- Easy distributed generation
- No sequence collisions
- Better horizontal scaling
- Easier replication

---

## Why Not Auto Increment?

Auto-increment integers cause:

- sequence bottlenecks
- merge conflicts
- predictable IDs

UUIDs eliminate these problems.

---

## UUID Version

Recommended:

```text
UUID v7
```

Reasons:

- Time ordered
- Better index locality
- Better insertion performance
- Natural chronological sorting

If unavailable:

```text
UUID v4
```

during development.

---

# 3.10 Foreign Keys

Foreign keys are always:

```text
<referenced_table>_id
```

Examples:

```text
tenant_id

worker_id

job_id

schedule_id

notification_id

role_id

user_id
```

Never:

```text
tenant

worker

jobReference

FK_JOB
```

---

# 3.11 Timestamp Standards

Every table should contain:

```text
created_at

updated_at
```

Optional:

```text
deleted_at
```

Business timestamps:

```text
execute_at

started_at

finished_at

last_retry_at

next_retry_at
```

All timestamps use:

```sql
TIMESTAMP WITH TIME ZONE
```

Always stored in:

```text
UTC
```

Never store local time.

---

# 3.12 Soft Deletes

Business entities should support soft deletion.

Example:

```text
deleted_at
```

Instead of:

```sql
DELETE FROM jobs
```

Use:

```sql
UPDATE jobs

SET deleted_at = NOW()
```

Historical information remains available.

Execution history and audit records are never soft deleted.

---

# 3.13 Status Columns

Every state machine uses:

```text
status
```

Not:

```text
job_status

execution_state

currentStatus
```

Examples:

```text
READY

DISPATCHED

RUNNING

FAILED

COMPLETED
```

Status values should be implemented using PostgreSQL ENUMs where the lifecycle is stable, or lookup tables if statuses need to evolve dynamically.

---

# 3.14 Boolean Columns

Use positive names.

Good:

```text
is_enabled

is_deleted

is_active

is_locked
```

Bad:

```text
disabled

inactive

not_enabled
```

Positive names make queries easier to read.

---

# 3.15 JSON Columns

Use:

```text
payload

metadata

headers

context

result
```

Example:

```sql
payload JSONB
```

Avoid:

```text
json_data

blob

misc
```

JSON columns should have a clearly defined purpose.

---

# 3.16 Constraint Naming

Constraints follow a predictable pattern.

Primary key:

```text
pk_jobs
```

Foreign key:

```text
fk_execution_history_job
```

Unique:

```text
uq_jobs_external_id
```

Check:

```text
chk_retry_count
```

Examples:

```sql
CONSTRAINT pk_jobs

CONSTRAINT fk_jobs_tenant

CONSTRAINT uq_jobs_idempotency_key
```

---

# 3.17 Index Naming

Indexes follow:

```text
idx_<table>_<column>
```

Examples:

```text
idx_jobs_execute_at

idx_jobs_status

idx_jobs_tenant

idx_jobs_priority
```

Composite index:

```text
idx_jobs_status_execute_at
```

Partial index:

```text
idx_jobs_waiting_execute_at
```

GIN index:

```text
gin_jobs_payload
```

BRIN index:

```text
brin_execution_history_created_at
```

---

# 3.18 Trigger Naming

Format:

```text
trg_<table>_<purpose>
```

Examples:

```text
trg_jobs_updated_at

trg_jobs_soft_delete

trg_retry_history_insert
```

---

# 3.19 Function Naming

Functions describe actions.

Examples:

```text
calculate_next_retry()

generate_bucket()

expand_cron()

mark_job_running()

archive_old_jobs()
```

Avoid generic names like:

```text
process()

run()

execute()
```

---

# 3.20 SQL Style Guide

Keywords:

```sql
SELECT

FROM

WHERE

ORDER BY
```

Uppercase.

Identifiers:

```sql
jobs

tenant_id

execute_at
```

Lowercase.

Example:

```sql
SELECT id,
       execute_at,
       priority
FROM scheduler.jobs
WHERE status = 'READY'
ORDER BY execute_at;
```

Readable SQL is easier to maintain than compressed one-line queries.

---

# 3.21 Migration Standards

Each migration:

- Performs one logical change.
- Is reversible where possible.
- Has a descriptive filename.
- Avoids unrelated modifications.

Example:

```text
001_create_scheduler_schema.sql

002_create_jobs_table.sql

003_add_retry_indexes.sql

004_create_execution_history.sql
```

Never create unrelated tables in the same migration.

---

# 3.22 Documentation Standards

Every table should document:

- Purpose
- Owner service
- Relationships
- Important indexes
- Expected growth
- Retention policy

Example:

```sql
COMMENT ON TABLE scheduler.jobs IS
'Stores all scheduled jobs awaiting execution.';
```

Column comments should explain non-obvious fields.

---

# 3.23 Future Evolution

As the platform grows:

```text
Phase 1

Basic Tables

↓

Phase 2

Naming Standards

↓

Phase 3

Automated Linters

↓

Phase 4

Schema Validation

↓

Phase 5

Generated Documentation
```

Tooling can automatically verify compliance with these conventions.

---

# 3.24 Best Practices

The database follows these naming principles:

- Use lowercase snake_case.
- Use plural table names.
- Use singular schema names.
- Primary key is always `id`.
- Foreign keys use `<entity>_id`.
- Store timestamps in UTC.
- Use UUIDs for primary keys.
- Name every constraint.
- Name every index.
- Keep SQL readable and consistent.
- Document tables and important columns.
- Prefer clarity over brevity.

---

# 3.25 Naming Examples

| Object                 | Example               |
| ---------------------- | --------------------- |
| Schema                 | `scheduler`           |
| Table                  | `jobs`                |
| Primary Key            | `id`                  |
| Foreign Key            | `tenant_id`           |
| Timestamp              | `created_at`          |
| Boolean                | `is_active`           |
| JSON                   | `payload`             |
| Index                  | `idx_jobs_execute_at` |
| Primary Key Constraint | `pk_jobs`             |
| Foreign Key Constraint | `fk_jobs_tenant`      |
| Trigger                | `trg_jobs_updated_at` |
| Function               | `generate_bucket()`   |

---

# Chapter Summary

This chapter established the naming and design conventions that every database object in the Distributed Task Scheduler Platform will follow. We defined standards for schemas, tables, columns, primary keys, UUID strategy, foreign keys, timestamps, status fields, JSON columns, constraints, indexes, triggers, functions, SQL formatting, migrations, and documentation. These conventions ensure that the database remains consistent, readable, and maintainable as it grows from a handful of tables to a large production-grade schema.

---

# Next Chapter

**Chapter 4 — Jobs Table Design**

The next chapter begins designing the core tables of the scheduler, starting with the **`scheduler.jobs`** table. It will define every column, data type, constraint, index, state transition, lifecycle, partitioning strategy, storage considerations, and query patterns, making it the single most important table in the entire platform.

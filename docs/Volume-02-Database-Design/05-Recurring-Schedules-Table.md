# Filename

**`V2-C05-Recurring-Schedules-Table.md`**

---

# Volume 2 — Database Design

# Chapter 5 — Recurring Schedules Table Design

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 5

**Filename:** `V2-C05-Recurring-Schedules-Table.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why a Separate Recurring Schedules Table?
3. Responsibilities
4. Relationship with Jobs
5. Schedule Lifecycle
6. Table Structure
7. Column-by-Column Design
8. Cron Expressions
9. Timezone Handling
10. Catch-up Policies
11. Pause & Resume
12. Cron Expander Interaction
13. Query Patterns
14. Constraints & Indexes
15. Partitioning Considerations
16. Complete SQL
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 5.1 Introduction

Not every scheduled task is a one-time execution.

Many business processes repeat according to a schedule.

Examples include:

- Daily invoice generation
- Hourly report creation
- Weekly database cleanup
- Monthly billing
- Every 5-minute health checks
- Every 30-second cache refresh
- Cron-based automation

Unlike one-time jobs, recurring schedules represent **instructions for generating jobs**, not executable work themselves.

This distinction is fundamental to the scheduler's architecture.

---

# 5.2 Why a Separate Recurring Schedules Table?

A common mistake is storing recurring jobs directly in the `jobs` table.

Example:

```text
jobs

Job A
Daily

Job B
Every Hour

Job C
Every Minute
```

This creates several problems:

- Infinite future jobs
- Difficult updates
- Impossible pause/resume
- Complex retry logic
- Duplicate scheduling

Instead, recurring schedules are stored separately.

```text
recurring_schedules

↓

Generate

↓

jobs
```

The schedule is a **template**.

The job is a **single execution instance**.

---

# 5.3 Responsibilities

The `scheduler.recurring_schedules` table stores:

- Cron expression
- Timezone
- Schedule status
- Next execution time
- Catch-up policy
- Schedule metadata
- Ownership
- Retry defaults

It does **not** store:

- Individual executions
- Execution history
- Notification history
- Retry attempts

Those belong elsewhere.

---

# 5.4 Relationship with Jobs

Relationship:

```text
Recurring Schedule

↓

Cron Expander

↓

Job Instance

↓

Worker

↓

Completed
```

One recurring schedule may generate:

```text
Schedule A

↓

Job #1

↓

Job #2

↓

Job #3

↓

Job #4

↓

...
```

This is a **one-to-many relationship**.

---

# 5.5 Schedule Lifecycle

A schedule progresses through several states.

```text
CREATE

↓

ACTIVE

↓

GENERATING JOBS

↓

PAUSED

↓

ACTIVE

↓

DISABLED

↓

ARCHIVED
```

Unlike jobs, schedules are long-lived entities.

---

# 5.6 Table Structure

```text
scheduler.recurring_schedules

├── Identity
├── Cron Configuration
├── Execution State
├── Generation Metadata
├── Ownership
├── Retry Defaults
├── Tenant
└── Audit
```

---

# 5.7 Complete Column Design

## Identity

| Column      | Type         | Description       |
| ----------- | ------------ | ----------------- |
| id          | UUID         | Primary key       |
| external_id | VARCHAR(255) | Client identifier |

---

## Multi-Tenant

| Column     | Type |
| ---------- | ---- |
| tenant_id  | UUID |
| created_by | UUID |

---

## Schedule Definition

| Column          | Type         |
| --------------- | ------------ |
| name            | VARCHAR(255) |
| description     | TEXT         |
| cron_expression | VARCHAR(255) |
| timezone        | VARCHAR(100) |

---

## State

| Column     | Type            |
| ---------- | --------------- |
| status     | schedule_status |
| is_enabled | BOOLEAN         |

---

## Execution

| Column            | Type        |
| ----------------- | ----------- |
| next_execution_at | TIMESTAMPTZ |
| last_execution_at | TIMESTAMPTZ |
| last_generated_at | TIMESTAMPTZ |

---

## Job Template

| Column   | Type         |
| -------- | ------------ |
| handler  | VARCHAR(255) |
| payload  | JSONB        |
| metadata | JSONB        |

---

## Retry Defaults

| Column              | Type           |
| ------------------- | -------------- |
| max_retries         | INTEGER        |
| retry_strategy      | retry_strategy |
| retry_delay_seconds | INTEGER        |

---

## Catch-up Policy

| Column          | Type            |
| --------------- | --------------- |
| catch_up_policy | catch_up_policy |

---

## Ownership

| Column          | Type        |
| --------------- | ----------- |
| cron_service_id | UUID        |
| lease_until     | TIMESTAMPTZ |

---

## Audit

| Column     | Type        |
| ---------- | ----------- |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |
| deleted_at | TIMESTAMPTZ |

---

# 5.8 Why Each Column Exists

## cron_expression

Defines recurrence.

Examples:

```text
0 * * * *

*/5 * * * *

0 0 * * *

0 8 * * MON
```

The scheduler stores the expression exactly as provided.

Validation occurs before insertion.

---

## timezone

Consider:

```text
Every day

08:00
```

Without timezone:

Which 08:00?

UTC?

India?

London?

New York?

Instead:

```text
Asia/Kolkata

Europe/London

America/New_York
```

Each schedule executes according to its configured timezone.

---

## next_execution_at

The Cron Expander continuously searches:

```sql
WHERE next_execution_at <= NOW()
```

This avoids recalculating every cron expression on every scan.

---

## handler

Defines which Worker handler should execute generated jobs.

Example:

```text
invoice.generate

email.send

payment.retry

cleanup.logs
```

Workers register handlers by name.

---

## payload

Template payload.

Example:

```json
{
  "customerType": "premium",
  "sendReminder": true
}
```

Every generated job receives a copy.

---

# 5.9 Cron Expressions

Supported syntax:

```text
* * * * *

┬ ┬ ┬ ┬ ┬

│ │ │ │ │

│ │ │ │ Day of Week

│ │ │ Month

│ │ Day

│ Hour

Minute
```

Future versions may support six-field expressions including seconds.

---

# 5.10 Timezone Handling

Every schedule stores its own timezone.

Example:

```text
Schedule A

08:00

Asia/Kolkata
```

and

```text
Schedule B

08:00

America/New_York
```

Both execute at 08:00 **local time**.

Internally, the Cron Service converts them to UTC before generating jobs.

---

# 5.11 Catch-up Policies

Suppose the scheduler is offline.

Missed executions occur.

Example:

```text
09:00

09:05

09:10

↓

System Down
```

Recovery depends on policy.

---

## SKIP

Ignore missed executions.

```text
09:00

↓

Missed

↓

Ignore
```

---

## EXECUTE_ONCE

Generate one immediate job.

---

## EXECUTE_ALL

Generate every missed execution.

Useful for financial processing.

---

## LIMIT

Generate only the most recent N executions.

Prevents massive recovery bursts.

---

# 5.12 Pause & Resume

Schedules may be paused.

```text
ACTIVE

↓

PAUSED
```

While paused:

No jobs are generated.

Existing jobs continue executing.

Resume:

```text
PAUSED

↓

ACTIVE
```

Generation continues from the configured catch-up policy.

---

# 5.13 Cron Expander Interaction

The Cron Expander periodically executes:

```text
Recurring Schedule

↓

Calculate Next Time

↓

Insert Job

↓

Update next_execution_at
```

The schedule itself never becomes a RabbitMQ message.

Only generated jobs do.

---

# 5.14 Query Patterns

Cron lookup:

```sql
SELECT *
FROM scheduler.recurring_schedules
WHERE status='ACTIVE'
AND next_execution_at<=NOW();
```

Tenant schedules:

```sql
SELECT *
FROM scheduler.recurring_schedules
WHERE tenant_id=$1;
```

Disabled schedules:

```sql
SELECT *
FROM scheduler.recurring_schedules
WHERE is_enabled=false;
```

---

# 5.15 Constraints

Primary key:

```sql
PRIMARY KEY(id)
```

Foreign keys:

```text
tenant_id

↓

identity.tenants
```

Check:

```text
max_retries >= 0
```

Check:

```text
retry_delay_seconds >= 0
```

Cron expression validated before insertion.

---

# 5.16 Index Strategy

Most important:

```sql
(status, next_execution_at)
```

Cron Service scans using this index.

Additional indexes:

```text
tenant_id

created_by

handler

cron_expression
```

Partial index:

```sql
(status='ACTIVE')
```

Improves Cron Expander performance.

---

# 5.17 Relationship Diagram

```text
recurring_schedules

        │

        │ 1

        │

        ▼

jobs

        │

        │ N

        ▼

execution_history
```

One schedule generates many jobs.

Each job generates many execution records through retries.

---

# 5.18 Initial SQL Definition

```sql
CREATE TABLE scheduler.recurring_schedules (

    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,

    created_by UUID,

    external_id VARCHAR(255),

    name VARCHAR(255) NOT NULL,

    description TEXT,

    cron_expression VARCHAR(255) NOT NULL,

    timezone VARCHAR(100) NOT NULL,

    handler VARCHAR(255) NOT NULL,

    payload JSONB NOT NULL,

    metadata JSONB,

    status schedule_status NOT NULL,

    is_enabled BOOLEAN DEFAULT TRUE,

    next_execution_at TIMESTAMPTZ NOT NULL,

    last_execution_at TIMESTAMPTZ,

    last_generated_at TIMESTAMPTZ,

    max_retries INTEGER DEFAULT 5,

    retry_strategy retry_strategy,

    retry_delay_seconds INTEGER,

    catch_up_policy catch_up_policy,

    cron_service_id UUID,

    lease_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    deleted_at TIMESTAMPTZ
);
```

---

# 5.19 Future Evolution

```text
Basic Cron Support

↓

Timezone Support

↓

Pause / Resume

↓

Distributed Cron Expansion

↓

Calendar Scheduling

↓

Business Calendars

↓

Holiday Rules

↓

Complex Workflow Scheduling
```

The schema is designed to evolve without breaking existing schedules.

---

# 5.20 Best Practices

- Store schedules separately from jobs.
- Never generate infinite future jobs.
- Store timezone explicitly.
- Validate cron expressions before persistence.
- Keep payload immutable.
- Pause schedules instead of deleting them.
- Update `next_execution_at` transactionally.
- Support configurable catch-up behavior.
- Index active schedules by execution time.
- Archive obsolete schedules rather than removing history.

---

# Chapter Summary

This chapter designed the `scheduler.recurring_schedules` table, which defines long-lived recurring schedules that generate executable job instances. We examined the separation between schedules and jobs, lifecycle management, cron expressions, timezone support, catch-up policies, pause/resume behavior, interaction with the Cron Expander, indexing strategy, constraints, relationships, and an initial SQL schema. By treating recurring schedules as templates rather than executable work, the platform avoids infinite future job creation while supporting scalable, reliable recurring execution.

---

# Next Chapter

**Filename:** `V2-C06-Retry-Metadata.md`

**Chapter 6 — Retry Metadata & Retry History Design**

The next chapter will design how retry information is persisted, including retry policies, retry history, exponential backoff, jitter configuration, retry scheduling, failure classification, dead-letter routing, and the relationship between retry metadata and the `jobs` table.

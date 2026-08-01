# Filename

**`V2-C13-Audit-And-Domain-Event-Storage.md`**

---

# Volume 2 — Database Design

# Chapter 13 — Audit Log & Domain Event Storage

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 13

**Filename:** `V2-C13-Audit-And-Domain-Event-Storage.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Audit Logs Exist
3. Audit Logs vs Domain Events
4. Audit Architecture
5. Audit Lifecycle
6. Audit Events Table
7. Domain Events Table
8. Column-by-Column Design
9. Actor Tracking
10. Event Replay
11. Compliance & Retention
12. Query Patterns
13. Constraints & Indexes
14. Complete SQL
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 13.1 Introduction

Every production system answers two different questions.

The first is:

> **What is the current state?**

Example:

```text
Job 845

↓

COMPLETED
```

The second is:

> **How did we reach this state?**

Example:

```text
Job Created

↓

Job Updated

↓

Dispatched

↓

Worker Started

↓

Completed
```

The first question is answered by operational tables like `jobs`.

The second is answered by **Audit Logs** and **Domain Events**.

Without auditing, production debugging, compliance, and security investigations become extremely difficult.

---

# 13.2 Why Audit Logs Exist

Suppose someone deletes an important recurring schedule.

Tomorrow another engineer asks:

> "Who deleted it?"

Without auditing:

```text
Schedule

↓

Gone
```

No explanation exists.

With auditing:

```text
Schedule

↓

Delete

↓

User

↓

Time

↓

Reason

↓

IP Address
```

Everything is recorded.

---

# 13.3 Audit Logs vs Domain Events

Although they appear similar, they serve different purposes.

## Audit Log

Answers:

> **Who performed an action?**

Example:

```text
User

↓

Deleted Schedule

↓

15:42 UTC
```

---

## Domain Event

Answers:

> **What business event occurred?**

Example:

```text
Job Completed
```

Another example:

```text
Payment Captured
```

Audit focuses on actors.

Domain events focus on business changes.

---

# 13.4 Audit Architecture

```text
REST API

↓

API Gateway

↓

Business Service

↓

Update Database

↓

Write Audit Event

↓

Publish Domain Event
```

The business transaction should complete before external consumers react.

---

# 13.5 Audit Lifecycle

```text
User Action

↓

Business Validation

↓

Database Transaction

↓

Audit Record

↓

Commit

↓

Publish Domain Event
```

Audit records are created inside the same transaction whenever possible.

---

# 13.6 Audit Events Table

Table:

```text
audit.audit_events
```

Purpose:

Record every important action.

Examples:

- Create Job
- Delete Job
- Pause Schedule
- Resume Schedule
- Replay DLQ
- Update Retry Policy
- Login
- API Key Created

Audit events are **append-only**.

They are never updated.

---

# 13.7 Audit Events Structure

```text
audit.audit_events

├── Identity
├── Actor
├── Resource
├── Action
├── Change Summary
├── Request Context
├── Tracing
└── Audit
```

---

## Identity

| Column | Type |
| ------ | ---- |
| id     | UUID |

---

## Actor

| Column     | Type       |
| ---------- | ---------- |
| actor_id   | UUID       |
| actor_type | actor_type |
| tenant_id  | UUID       |

---

## Resource

| Column        | Type         |
| ------------- | ------------ |
| resource_type | VARCHAR(100) |
| resource_id   | UUID         |

---

## Action

| Column | Type         |
| ------ | ------------ |
| action | audit_action |

Examples:

```text
CREATE

UPDATE

DELETE

PAUSE

RESUME

REPLAY

LOGIN
```

---

## Change Summary

| Column         | Type  |
| -------------- | ----- |
| previous_value | JSONB |
| new_value      | JSONB |

---

## Request Context

| Column     | Type |
| ---------- | ---- |
| ip_address | INET |
| user_agent | TEXT |
| request_id | UUID |

---

## Tracing

| Column         | Type |
| -------------- | ---- |
| trace_id       | UUID |
| correlation_id | UUID |

---

## Audit

| Column     | Type        |
| ---------- | ----------- |
| created_at | TIMESTAMPTZ |

---

# 13.8 Why Store Previous & New Values?

Suppose someone changes:

```text
Max Retries

5

↓

10
```

Without history:

Current value:

```text
10
```

We lose:

```text
5
```

Instead:

```json
Previous

{
  "maxRetries":5
}
```

```json
New

{
  "maxRetries":10
}
```

This enables complete change history.

---

# 13.9 Domain Events

Table:

```text
audit.domain_events
```

Purpose:

Represent business events.

Examples:

```text
JobCreated

JobCompleted

RetryScheduled

NotificationDelivered

DLQReplayStarted

SchedulePaused
```

These events are consumed by other services.

---

# 13.10 Domain Events Structure

```text
audit.domain_events

├── Identity
├── Event Metadata
├── Aggregate
├── Payload
├── Publication
└── Audit
```

---

## Columns

| Column         | Type         |
| -------------- | ------------ |
| id             | UUID         |
| event_name     | VARCHAR(255) |
| aggregate_type | VARCHAR(100) |
| aggregate_id   | UUID         |
| event_version  | INTEGER      |
| payload        | JSONB        |
| published      | BOOLEAN      |
| published_at   | TIMESTAMPTZ  |
| created_at     | TIMESTAMPTZ  |

---

# 13.11 Why Separate Audit & Domain Events?

Many systems combine them.

Problems:

Audit:

```text
User Changed Retry Policy
```

Domain Event:

```text
RetryPolicyUpdated
```

One is for humans.

The other is for software.

Keeping them separate avoids unnecessary coupling.

---

# 13.12 Actor Tracking

An action may originate from:

```text
User
```

or

```text
Service Account
```

or

```text
Cron Service
```

or

```text
System
```

Actor type records the source.

Example:

```text
SYSTEM
```

Generated automatically.

---

# 13.13 Event Replay

Suppose Analytics Service is offline.

Events remain:

```text
Domain Events

↓

published=false
```

Later:

```text
Analytics Online

↓

Replay Events
```

Event publication resumes.

This resembles a lightweight **Outbox Pattern**.

---

# 13.14 Compliance

Audit records support:

- GDPR investigations
- SOC2
- ISO 27001
- PCI DSS
- Internal security reviews

Retention policies may require:

```text
7 Years
```

Audit records are rarely deleted.

Instead they are archived.

---

# 13.15 Relationship Diagram

```text
User

    │

    ▼

jobs

    │

    ▼

audit_events

    │

    ▼

domain_events

    │

    ▼

External Services
```

Every important state transition creates both an audit record and (where appropriate) a domain event.

---

# 13.16 Query Patterns

User history:

```sql
SELECT *
FROM audit.audit_events
WHERE actor_id = $1;
```

Resource history:

```sql
SELECT *
FROM audit.audit_events
WHERE resource_id = $1;
```

Unpublished events:

```sql
SELECT *
FROM audit.domain_events
WHERE published = FALSE;
```

Security audit:

```sql
SELECT *
FROM audit.audit_events
WHERE action='DELETE';
```

Recent events:

```sql
SELECT *
FROM audit.domain_events
ORDER BY created_at DESC;
```

---

# 13.17 Constraints

Audit Events

```sql
PRIMARY KEY(id)
```

Domain Events

```sql
PRIMARY KEY(id)
```

Checks:

```sql
event_version > 0
```

```sql
published_at >= created_at
```

Foreign Keys (optional depending on retention policy):

```text
tenant_id

↓

identity.tenants
```

Many systems intentionally avoid foreign keys in audit tables so historical records survive even if business entities are deleted.

---

# 13.18 Index Strategy

Audit:

```text
(actor_id)
```

```text
(resource_id)
```

```text
(action)
```

```text
(created_at)
```

Domain Events:

```text
(event_name)
```

```text
(published)
```

```text
(aggregate_id)
```

Composite:

```text
(resource_type, resource_id)
```

Composite:

```text
(published, created_at)
```

This makes unpublished event polling efficient.

---

# 13.19 Initial SQL Definition

## audit_events

```sql
CREATE TABLE audit.audit_events (

    id UUID PRIMARY KEY,

    actor_id UUID,

    actor_type actor_type,

    tenant_id UUID,

    resource_type VARCHAR(100),

    resource_id UUID,

    action audit_action,

    previous_value JSONB,

    new_value JSONB,

    ip_address INET,

    user_agent TEXT,

    request_id UUID,

    trace_id UUID,

    correlation_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## domain_events

```sql
CREATE TABLE audit.domain_events (

    id UUID PRIMARY KEY,

    event_name VARCHAR(255),

    aggregate_type VARCHAR(100),

    aggregate_id UUID,

    event_version INTEGER DEFAULT 1,

    payload JSONB,

    published BOOLEAN DEFAULT FALSE,

    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 13.20 Audit Timeline Example

```text
User Creates Job

↓

Audit Record

↓

Job Created Event

↓

Scanner Dispatches Job

↓

Audit Record

↓

Job Dispatched Event

↓

Worker Completes Job

↓

Audit Record

↓

Job Completed Event
```

Notice that every important action leaves two trails:

- Human-readable audit trail
- Machine-readable business event

---

# 13.21 Future Evolution

```text
Audit Tables

↓

Domain Events

↓

Transactional Outbox

↓

Kafka Event Bus

↓

Event Replay

↓

Full Event Sourcing
```

Although our scheduler is **not** an Event Sourcing system, this schema allows migration toward one if required.

---

# 13.22 Best Practices

- Keep audit records immutable.
- Never update audit history.
- Separate audit logs from domain events.
- Record both previous and new values for updates.
- Capture actor identity and request context.
- Store tracing identifiers.
- Archive rather than delete audit data.
- Poll unpublished domain events reliably.
- Keep event payloads versioned.
- Use audit records for compliance and forensic analysis.

---

# Chapter Summary

This chapter designed the platform's audit and domain event storage model. We separated human-focused audit logs from machine-focused domain events, defined immutable append-only tables, explored actor tracking, request context, change history, event publication, replay, compliance considerations, indexing strategies, and complete SQL definitions. Together, these tables provide accountability, traceability, and integration capabilities while preparing the platform for future event-driven architectures.

---

# Next Chapter

**Filename:** `V2-C14-System-Configuration-And-Feature-Flags.md`

**Chapter 14 — System Configuration & Feature Flags**

The next chapter will design the `config` schema, including runtime configuration, retry policies, scheduler tuning parameters, worker limits, tenant-specific overrides, feature flags, dynamic configuration reloading, configuration versioning, and environment-specific settings without requiring application redeployment.

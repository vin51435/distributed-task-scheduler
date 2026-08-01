# Filename

**`V2-C07-Idempotency-Storage.md`**

---

# Volume 2 — Database Design

# Chapter 7 — Idempotency Storage Design

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 7

**Filename:** `V2-C07-Idempotency-Storage.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Idempotency Exists
3. Exactly-Once vs Effectively-Once
4. Idempotency Architecture
5. Current State vs History
6. Idempotency Table Design
7. Column-by-Column Design
8. Idempotency Lifecycle
9. Worker Execution Flow
10. Race Conditions
11. Redis Integration
12. PostgreSQL Integration
13. Expiration & Cleanup
14. Query Patterns
15. Constraints & Indexes
16. Complete SQL
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 7.1 Introduction

Distributed systems cannot guarantee **exactly-once execution**.

Failures can occur after a worker completes business logic but before RabbitMQ receives the ACK.

Example:

```text
Worker

↓

Charge Credit Card

↓

Payment Success

↓

ACK RabbitMQ

↓

Network Failure
```

RabbitMQ never receives the ACK.

It assumes the worker failed.

The message is delivered again.

Without idempotency:

```text
Charge Card

↓

Charge Card Again
```

The customer is charged twice.

Idempotency prevents this.

---

# 7.2 Why Idempotency Exists

The scheduler guarantees:

- At-least-once delivery
- Effectively-once business execution

It does **not** guarantee:

```text
Exactly Once
```

Because no distributed system can provide exactly-once execution across arbitrary external systems.

Instead, repeated executions produce the same business result.

---

# 7.3 Exactly-Once vs Effectively-Once

## Exactly Once

```text
Execute

↓

Never Again
```

Impossible in a general distributed environment.

---

## At-Least-Once

```text
Execute

↓

Maybe Execute Again
```

RabbitMQ provides this.

---

## Effectively-Once

```text
Execute

↓

Duplicate Arrives

↓

Duplicate Detected

↓

Return Previous Result
```

This is what our scheduler implements.

---

# 7.4 Idempotency Architecture

```text
RabbitMQ

↓

Worker

↓

Redis Check

↓

PostgreSQL Check

↓

Business Logic

↓

Store Result

↓

ACK
```

Redis provides speed.

PostgreSQL provides durability.

---

# 7.5 Why Not Store Everything in Redis?

Redis is an in-memory cache.

If Redis crashes:

```text
Redis

↓

Restart

↓

Keys Lost
```

The scheduler would lose duplicate detection.

Instead:

```text
Redis

↓

Cache

↓

PostgreSQL

↓

Permanent Record
```

Redis accelerates lookups.

PostgreSQL remains the source of truth.

---

# 7.6 Current State vs Historical State

The `jobs` table stores:

```text
Current Status
```

The `idempotency_keys` table stores:

```text
Business Result
```

Execution history stores:

```text
Every Attempt
```

Three different responsibilities.

---

# 7.7 Table Structure

```text
scheduler.idempotency_keys

├── Identity
├── Request Information
├── Execution State
├── Cached Result
├── Ownership
├── Expiration
└── Audit
```

---

# 7.8 Complete Column Design

## Identity

| Column          | Type         | Description         |
| --------------- | ------------ | ------------------- |
| id              | UUID         | Primary key         |
| idempotency_key | VARCHAR(255) | Unique business key |

---

## References

| Column    | Type |
| --------- | ---- |
| tenant_id | UUID |
| job_id    | UUID |

---

## Request

| Column       | Type         |
| ------------ | ------------ |
| handler      | VARCHAR(255) |
| request_hash | CHAR(64)     |

---

## Result

| Column   | Type               |
| -------- | ------------------ |
| status   | idempotency_status |
| response | JSONB              |
| error    | JSONB              |

---

## Ownership

| Column    | Type |
| --------- | ---- |
| worker_id | UUID |

---

## Expiration

| Column     | Type        |
| ---------- | ----------- |
| expires_at | TIMESTAMPTZ |

---

## Audit

| Column     | Type        |
| ---------- | ----------- |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

---

# 7.9 Why Each Column Exists

## idempotency_key

Business identifier.

Example:

```text
payment-123456
```

or

```text
invoice-9845
```

Every logical operation must have a unique key.

---

## request_hash

Suppose:

```text
Key = payment-123
```

First request:

```json
{
  "amount": 100
}
```

Second request:

```json
{
  "amount": 500
}
```

Same key.

Different payload.

This should **not** be accepted.

Instead:

```text
Hash Payload

↓

Compare

↓

Mismatch

↓

Reject
```

---

## response

Stores successful execution.

Example:

```json
{
  "paymentId": "pay-928",
  "status": "SUCCESS"
}
```

Duplicate requests immediately return this cached result.

---

## error

If execution permanently failed:

```json
{
  "code": "PAYMENT_DECLINED",
  "message": "Card expired"
}
```

The scheduler may return the same error consistently.

---

# 7.10 Idempotency Lifecycle

```text
Request

↓

Check Redis

↓

Miss

↓

Check PostgreSQL

↓

Miss

↓

Insert Processing Record

↓

Execute

↓

Store Result

↓

Return Response
```

Duplicate:

```text
Request

↓

Redis Hit

↓

Return Cached Result
```

No business logic executes again.

---

# 7.11 Worker Flow

```text
RabbitMQ

↓

Worker

↓

Lookup Key

↓

Found?

↓

YES

↓

Return Cached Result

↓

ACK
```

Otherwise:

```text
Lookup

↓

Not Found

↓

Reserve Key

↓

Execute

↓

Save Result

↓

ACK
```

---

# 7.12 Race Conditions

Two workers may receive the same logical request.

Example:

```text
Worker A

↓

Insert Key
```

At the same time:

```text
Worker B

↓

Insert Same Key
```

Solution:

Unique constraint.

```text
UNIQUE(idempotency_key)
```

Worker B receives:

```text
Duplicate Key

↓

Read Existing Result
```

No duplicate execution occurs.

---

# 7.13 Redis Integration

Redis acts as a read-through cache.

Flow:

```text
Worker

↓

Redis

↓

Hit?

↓

YES

↓

Done
```

Miss:

```text
Redis

↓

Miss

↓

PostgreSQL

↓

Cache

↓

Return
```

Redis greatly reduces database reads.

---

# 7.14 PostgreSQL Integration

PostgreSQL stores permanent records.

Redis stores temporary cache.

Relationship:

```text
Redis

↓

Fast

↓

PostgreSQL

↓

Durable
```

Redis can be completely flushed.

Recovery simply rebuilds cache from PostgreSQL.

---

# 7.15 Expiration

Not every key lives forever.

Example:

Payment:

```text
Forever
```

Email:

```text
24 Hours
```

Webhook:

```text
7 Days
```

Each business operation decides expiration.

Expired keys may be archived or deleted.

---

# 7.16 Query Patterns

Lookup:

```sql
SELECT *
FROM scheduler.idempotency_keys
WHERE idempotency_key = $1;
```

Cleanup:

```sql
DELETE
FROM scheduler.idempotency_keys
WHERE expires_at < NOW();
```

Tenant:

```sql
SELECT *
FROM scheduler.idempotency_keys
WHERE tenant_id = $1;
```

Worker diagnostics:

```sql
SELECT *
FROM scheduler.idempotency_keys
WHERE worker_id = $1;
```

---

# 7.17 Constraints

Primary Key

```sql
PRIMARY KEY(id)
```

Unique

```sql
UNIQUE(idempotency_key)
```

Foreign Key

```sql
job_id REFERENCES scheduler.jobs(id)
```

Foreign Key

```sql
tenant_id REFERENCES identity.tenants(id)
```

Check

```sql
expires_at > created_at
```

---

# 7.18 Index Strategy

Primary lookup:

```sql
(idempotency_key)
```

Tenant:

```sql
(tenant_id)
```

Expiration cleanup:

```sql
(expires_at)
```

Worker diagnostics:

```sql
(worker_id)
```

Composite:

```sql
(tenant_id, idempotency_key)
```

Useful for multi-tenant systems.

---

# 7.19 Initial SQL Definition

```sql
CREATE TABLE scheduler.idempotency_keys (

    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL
        REFERENCES identity.tenants(id),

    job_id UUID
        REFERENCES scheduler.jobs(id),

    idempotency_key VARCHAR(255) NOT NULL UNIQUE,

    handler VARCHAR(255) NOT NULL,

    request_hash CHAR(64) NOT NULL,

    status idempotency_status NOT NULL,

    response JSONB,

    error JSONB,

    worker_id UUID,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 7.20 Why Separate Idempotency From Jobs?

Some schedulers place:

```text
idempotency_key
```

inside `jobs`.

That is insufficient because:

One job may not represent one business operation.

Example:

```text
API Request

↓

Create Invoice

↓

Send Email

↓

Generate PDF

↓

Notify CRM
```

Each operation may require independent idempotency.

Keeping idempotency in its own table allows:

- Independent expiration
- Cached responses
- Better indexing
- Reuse across services
- Cleaner architecture

---

# 7.21 Future Evolution

```text
PostgreSQL Only

↓

Redis Cache

↓

Distributed Cache

↓

Cross-Region Replication

↓

Global Idempotency Service
```

Large organizations often extract idempotency into its own service.

Our schema supports that future migration.

---

# 7.22 Best Practices

- Never rely on RabbitMQ for duplicate prevention.
- Use PostgreSQL as the durable idempotency store.
- Use Redis as a cache, not as the source of truth.
- Reserve idempotency keys before executing business logic.
- Store request hashes to detect payload mismatches.
- Cache successful responses when appropriate.
- Apply expiration policies based on business requirements.
- Use unique constraints to prevent race conditions.
- Keep idempotency independent of execution history.
- Monitor duplicate detection rates.

---

# Chapter Summary

This chapter designed the `scheduler.idempotency_keys` table and the persistence strategy for effectively-once execution. We explored why exactly-once execution is impossible in distributed systems, how idempotency bridges that gap, the interaction between Redis and PostgreSQL, race-condition handling, cached responses, request hashing, expiration policies, indexing, constraints, and the complete SQL schema. By separating idempotency into its own durable storage, the scheduler prevents duplicate business operations while maintaining high performance and fault tolerance.

---

# Next Chapter

**Filename:** `V2-C08-Time-Buckets-And-Bucket-Leases.md`

**Chapter 8 — Time Buckets & Bucket Leases Design**

The next chapter will design one of the most critical scalability features of the scheduler: **time buckets** and **bucket leases**. It will explain how millions of jobs are divided into time-based partitions, how Scanners acquire leases using PostgreSQL and Redis, how bucket ownership prevents duplicate scanning, bucket sizing strategies, lease expiration, failover, and the database tables that support distributed scheduling at scale.

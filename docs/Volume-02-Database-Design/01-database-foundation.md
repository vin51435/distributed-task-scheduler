## Document Information

**Volume:** 2 — Database Design

**Chapter:** 1

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why PostgreSQL?
3. Database Responsibilities
4. Why PostgreSQL is the Source of Truth
5. Database Boundaries
6. Database Design Principles
7. OLTP Design
8. Multi-Tenant Design
9. Database Lifecycle
10. Future Evolution
11. Best Practices
12. Chapter Summary

---

# 1.1 Introduction

The database is the heart of the Distributed Task Scheduler Platform.

Every service in the platform is designed to be **stateless**. Services can start, stop, scale, or fail without losing application state because all persistent business data resides in PostgreSQL.

Unlike Redis, which provides temporary coordination, or RabbitMQ, which temporarily transports messages, PostgreSQL is the authoritative record of the scheduler's state. If every application service crashes simultaneously, the platform can recover by reading its state from PostgreSQL.

The database is therefore not just a storage engine; it is the **persistent memory of the scheduler**.

---

# 1.2 Why PostgreSQL?

Several databases were evaluated before selecting PostgreSQL.

| Database   | Advantages                                                  | Why Not Selected                                                         |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| MongoDB    | Flexible schema, easy JSON storage                          | Weak transactional guarantees for complex scheduler state                |
| MySQL      | Mature relational database                                  | Fewer advanced indexing and partitioning features compared to PostgreSQL |
| Cassandra  | Excellent horizontal scalability                            | Eventual consistency unsuitable for scheduling accuracy                  |
| DynamoDB   | Fully managed, scalable                                     | Vendor lock-in and limited relational capabilities                       |
| Redis      | Extremely fast                                              | In-memory, not durable enough as the primary store                       |
| PostgreSQL | ACID, MVCC, JSONB, indexing, partitioning, mature ecosystem | **Selected**                                                             |

PostgreSQL provides the properties required by a scheduler:

- Strong consistency
- ACID transactions
- Rich indexing
- High write throughput
- Advanced query planner
- JSONB support
- Partitioning
- Streaming replication
- Mature tooling

---

# 1.3 Database Responsibilities

The database is responsible for storing all durable business state.

It stores:

```text
Jobs
Recurring Schedules
Retry Metadata
Execution Metadata
Idempotency Records
Notification History
Audit Events
Tenant Information
Configuration
```

The database does **not** execute jobs, calculate cron schedules, publish messages, or coordinate distributed workers. Those responsibilities belong to application services.

---

# 1.4 Why PostgreSQL is the Source of Truth

Every state transition is first persisted before other systems are involved.

For example, creating a job follows this order:

```text
Client
   │
   ▼
API Gateway
   │
   ▼
Timer Service
   │
   ▼
PostgreSQL
   │
   ▼
Scanner
   │
   ▼
Dispatcher
   │
   ▼
RabbitMQ
   │
   ▼
Worker
```

This ordering ensures that no job exists only in memory or only in RabbitMQ. If RabbitMQ is unavailable, the job still exists safely in PostgreSQL and can be dispatched later.

---

# 1.5 Database Boundaries

The database stores **business state**, while other infrastructure stores operational state.

| Component  | Stores                                                          |
| ---------- | --------------------------------------------------------------- |
| PostgreSQL | Jobs, schedules, retries, audit records, notifications, tenants |
| RabbitMQ   | Messages waiting for execution                                  |
| Redis      | Locks, leases, coordination, cache                              |
| MinIO      | Backups, archived exports, large objects                        |
| Prometheus | Metrics                                                         |
| Loki       | Logs                                                            |

This separation keeps each technology focused on what it does best.

---

# 1.6 Database Design Principles

The schema is designed according to the following principles:

### Durability First

Every business operation is committed before it is acted upon.

### Normalization with Pragmatism

Core entities are normalized to reduce duplication, while selected JSONB columns are used for flexible payloads and metadata.

### Immutable History

Operational history (audit events, execution records) is append-only. Existing history is never modified.

### Explicit State

Every job has a clearly defined lifecycle represented by explicit status values rather than inferred behavior.

### Scalability

Tables are designed with future partitioning and indexing in mind, avoiding patterns that require full-table scans.

### Observability

Most tables include timestamps, correlation IDs, and tenant IDs to support debugging and tracing.

---

# 1.7 OLTP Design

The scheduler is an **Online Transaction Processing (OLTP)** system.

Characteristics include:

- Many small writes
- Frequent updates
- Short transactions
- Indexed lookups
- Low latency
- High concurrency

Typical operations:

- Insert a new job
- Update job status
- Record execution
- Reserve an idempotency key
- Store retry metadata

Analytical queries are intentionally kept separate from operational transactions.

---

# 1.8 Multi-Tenant Design

The platform is designed from day one for multi-tenancy.

Every business table will include a `tenant_id` column.

Example:

```sql
SELECT *
FROM scheduler.jobs
WHERE tenant_id = :tenantId
  AND status = 'WAITING';
```

This ensures:

- Data isolation
- Simpler authorization
- Future sharding options
- Tenant-level reporting

Cross-tenant queries are avoided except for privileged administrative operations.

---

# 1.9 Database Lifecycle

A typical job progresses through the database as follows:

```text
INSERT Job
     │
     ▼
WAITING
     │
     ▼
DISPATCHED
     │
     ▼
RUNNING
     │
     ▼
COMPLETED
```

If failures occur:

```text
RUNNING
   │
   ▼
FAILED
   │
   ▼
WAITING (retry)
```

Each transition is recorded explicitly, enabling recovery after crashes.

---

# 1.10 Future Evolution

The initial deployment uses a single PostgreSQL primary with streaming replicas.

The planned evolution is:

```text
Single PostgreSQL
        │
        ▼
Streaming Replication
        │
        ▼
Read Replicas
        │
        ▼
Partitioned Tables
        │
        ▼
Cross-Region Replication
```

The schema is designed so that these infrastructure changes do not require application-level redesign.

---

# 1.11 Best Practices

The database layer follows these principles:

- PostgreSQL is the only source of truth.
- Keep transactions short.
- Never use the database as a message queue.
- Index every frequently queried predicate.
- Store timestamps in UTC.
- Prefer UUID primary keys.
- Avoid full-table scans.
- Separate operational and analytical workloads.
- Record immutable history.
- Design for future partitioning.

---

# 1.12 Chapter Summary

This chapter established the architectural role of PostgreSQL within the Distributed Task Scheduler Platform. We defined the database as the authoritative source of business state, distinguished its responsibilities from Redis and RabbitMQ, explained the rationale for choosing PostgreSQL, introduced the guiding design principles, discussed OLTP characteristics, multi-tenant architecture, lifecycle management, and the long-term evolution of the persistence layer.

With this foundation established, the next chapter will design the **logical database organization**, introducing schemas, namespaces, and how the database is structured before defining any individual tables.

---

# Next Chapter

**Chapter 2 — Database Schemas & Namespace Organization**

We will design the complete PostgreSQL namespace layout, explaining why the database is divided into multiple schemas (such as `scheduler`, `audit`, `notification`, and `config`), how this improves modularity and security, and how each service maps to its own logical storage domain.

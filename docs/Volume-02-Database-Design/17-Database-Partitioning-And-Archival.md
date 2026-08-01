# Filename

**`V2-C17-Database-Partitioning-And-Archival.md`**

---

# Volume 2 — Database Design

# Chapter 17 — Database Partitioning, Retention & Archival Strategy

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 17

**Filename:** `V2-C17-Database-Partitioning-And-Archival.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Partitioning is Required
3. The Growth Problem
4. Partitioning Strategy
5. Tables That Should Be Partitioned
6. Partition Types
7. Time-Based Partitioning
8. Tenant-Based Partitioning
9. Hybrid Partitioning
10. Retention Policies
11. Archival Strategy
12. Cold Storage
13. Partition Maintenance
14. Query Patterns
15. Constraints & Indexes
16. Example SQL
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 17.1 Introduction

Our scheduler is designed to execute **hundreds of millions or even billions of jobs** over its lifetime.

Some tables grow continuously:

- execution_history
- retry_history
- dispatch_history
- audit_events
- domain_events
- notification delivery history
- metrics
- dead_letter_jobs

Without proper partitioning, PostgreSQL eventually suffers from:

- Slow queries
- Large indexes
- Long VACUUM operations
- Increased backup times
- Poor cache efficiency
- Longer failover times

Partitioning allows PostgreSQL to treat one logical table as many smaller physical tables.

---

# 17.2 Why Partitioning is Required

Imagine a single table:

```text
execution_history

↓

1,200,000,000 rows
```

A query:

```sql
SELECT *
FROM execution_history
WHERE created_at > NOW() - INTERVAL '1 day';
```

Without partitioning PostgreSQL may inspect a massive index covering years of data.

Instead:

```text
execution_history

↓

2026

↓

August

↓

Partition
```

Only one partition is searched.

This is called **Partition Pruning**.

---

# 17.3 The Growth Problem

Estimated yearly growth:

| Table             | Estimated Rows/Year |
| ----------------- | ------------------: |
| jobs              |         200 million |
| execution_history |         450 million |
| retry_history     |          50 million |
| dispatch_history  |         220 million |
| audit_events      |          80 million |
| metrics           |           1 billion |
| notifications     |         300 million |

Large tables require special handling.

---

# 17.4 Partitioning Strategy

Not every table should be partitioned.

Reference tables remain small.

Examples:

```text
identity.users

roles

permissions

feature_flags

retry_policies
```

No partitioning required.

Large append-only tables should be partitioned.

---

# 17.5 Tables That Should Be Partitioned

Recommended:

```text
scheduler.jobs

execution_history

retry_history

dispatch_history

dead_letter_jobs

audit_events

domain_events

notifications

delivery_attempts

metrics

queue_metrics
```

Small lookup tables remain normal tables.

---

# 17.6 Partition Types

PostgreSQL supports multiple partitioning methods.

---

## Range Partition

Example:

```text
January

↓

February

↓

March
```

Best for:

Time-series data.

---

## List Partition

Example:

```text
Tenant A

Tenant B

Tenant C
```

Best for:

Multi-tenant isolation.

---

## Hash Partition

Example:

```text
hash(id)

↓

Partition 1

Partition 2

Partition 3
```

Useful for evenly distributing write load.

---

# 17.7 Time-Based Partitioning

Most scheduler tables grow by time.

Example:

```text
execution_history

↓

2026-08

↓

2026-09

↓

2026-10
```

Monthly partitions provide a good balance.

Example:

```sql
PARTITION BY RANGE(created_at)
```

Partition:

```text
August

↓

2026-08-01

↓

2026-08-31
```

---

# 17.8 Why Monthly?

Daily:

```text
365 Partitions
```

Too many.

---

Yearly:

```text
1 Partition
```

Too large.

---

Monthly:

```text
12 Partitions
```

Balanced.

Recommended default.

---

# 17.9 Tenant-Based Partitioning

Very large SaaS customers may justify separate partitions.

Example:

```text
Tenant

↓

Acme

↓

Dedicated Partition
```

Small tenants:

```text
Shared Partition
```

This simplifies:

- GDPR deletion
- Backups
- Migration
- Performance isolation

---

# 17.10 Hybrid Partitioning

Large installations often combine both.

Example:

```text
Tenant

↓

Month

↓

Partition
```

Example:

```text
Acme

↓

2026 August
```

Another:

```text
Globex

↓

2026 August
```

Hybrid partitioning improves scalability for enterprise customers.

---

# 17.11 Retention Policies

Not every record must remain forever.

Recommended policies:

| Table                 | Retention |
| --------------------- | --------- |
| execution_history     | 1 year    |
| retry_history         | 1 year    |
| dispatch_history      | 1 year    |
| queue_metrics         | 90 days   |
| worker_heartbeats     | 30 days   |
| audit_events          | 7 years   |
| domain_events         | 2 years   |
| notification delivery | 1 year    |
| metrics               | 180 days  |

Retention depends on business and compliance requirements.

---

# 17.12 Archival Strategy

Old data should not be deleted immediately.

Workflow:

```text
Old Partition

↓

Archive

↓

Compressed Storage

↓

Delete From Database
```

Archives may be stored in:

- S3
- Azure Blob Storage
- Google Cloud Storage
- Glacier
- Cold PostgreSQL Cluster

---

# 17.13 Cold Storage

Frequently accessed data:

```text
Hot Storage
```

↓

Recent months.

Older:

```text
Warm Storage
```

↓

Archived PostgreSQL.

Oldest:

```text
Cold Storage
```

↓

Compressed files.

Example:

```text
2021 Metrics

↓

Parquet

↓

S3
```

---

# 17.14 Partition Maintenance

Every month:

```text
Create New Partition
```

Every day:

```text
Archive Old Partitions
```

Every week:

```text
VACUUM ANALYZE
```

Automation jobs maintain partitions.

---

# 17.15 Partition Lifecycle

```text
Partition Created

↓

Active

↓

Read Mostly

↓

Archived

↓

Deleted
```

Every partition has its own lifecycle.

---

# 17.16 Relationship Diagram

```text
execution_history

        │

        ▼

2026-07

2026-08

2026-09

2026-10
```

Queries automatically search only relevant partitions.

---

# 17.17 Query Patterns

Recent executions:

```sql
SELECT *
FROM scheduler.execution_history
WHERE created_at >
NOW() - INTERVAL '7 days';
```

Only recent partitions are scanned.

---

Archive candidates:

```sql
SELECT *
FROM scheduler.execution_history
WHERE created_at <
NOW() - INTERVAL '1 year';
```

---

Tenant history:

```sql
SELECT *
FROM scheduler.execution_history
WHERE tenant_id=$1
AND created_at >
NOW()-INTERVAL '30 days';
```

---

Metrics:

```sql
SELECT *
FROM monitoring.metrics
WHERE recorded_at >
NOW()-INTERVAL '24 hours';
```

---

# 17.18 Constraints

Parent Table

```sql
PRIMARY KEY(id, created_at)
```

Partition Keys:

```sql
created_at
```

Check:

```sql
created_at >= partition_start
```

Check:

```sql
created_at < partition_end
```

---

# 17.19 Index Strategy

Each partition has independent indexes.

Example:

```text
execution_history_2026_08

↓

(job_id)

(worker_id)

(trace_id)

(created_at)
```

Smaller indexes mean:

- Faster lookups
- Faster VACUUM
- Better cache locality
- Faster index rebuilds

---

# 17.20 Example SQL

Parent table:

```sql
CREATE TABLE scheduler.execution_history (

    id UUID,

    created_at TIMESTAMPTZ NOT NULL,

    job_id UUID,

    worker_id UUID,

    status execution_status

)
PARTITION BY RANGE(created_at);
```

Monthly partition:

```sql
CREATE TABLE scheduler.execution_history_2026_08
PARTITION OF scheduler.execution_history
FOR VALUES FROM ('2026-08-01')
TO ('2026-09-01');
```

---

# 17.21 Automatic Partition Creation

A scheduled maintenance job creates future partitions.

Example:

```text
Current Month

↓

August
```

Maintenance:

```text
Create

September

October

November
```

This prevents runtime failures when new data arrives.

---

# 17.22 Partition Pruning

Suppose:

```sql
WHERE created_at >
NOW()-INTERVAL '1 day'
```

PostgreSQL ignores:

```text
2024

2025

2026 January

2026 February
```

Only:

```text
2026 August
```

is scanned.

This dramatically improves query performance.

---

# 17.23 Backup Strategy

Backups become easier.

Example:

Recent:

```text
August

↓

Nightly Backup
```

Older:

```text
April

↓

Already Archived
```

Only active partitions require frequent backups.

---

# 17.24 Operational Dashboard

Useful metrics:

| Metric                  | Description          |
| ----------------------- | -------------------- |
| Active Partitions       | Current workload     |
| Largest Partition       | Capacity planning    |
| Archive Queue           | Pending archival     |
| Storage Growth          | Forecasting          |
| Vacuum Duration         | Maintenance          |
| Index Size              | Optimization         |
| Partition Count         | Health               |
| Oldest Active Partition | Retention validation |

---

# 17.25 Future Evolution

```text
Single Tables

↓

Range Partitioning

↓

Hybrid Partitioning

↓

Sharding

↓

Geo-Sharding

↓

Distributed PostgreSQL
```

Future versions may migrate to:

- Citus
- YugabyteDB
- CockroachDB

while preserving the same logical schema.

---

# 17.26 Best Practices

- Partition only large append-only tables.
- Use monthly range partitions by default.
- Keep lookup tables unpartitioned.
- Archive rather than immediately delete historical data.
- Automate partition creation.
- Monitor partition growth continuously.
- Use partition pruning for analytical queries.
- Keep indexes local to partitions.
- Compress archived partitions.
- Align retention policies with business and legal requirements.

---

# Chapter Summary

This chapter designed the database partitioning, retention, and archival strategy for the scheduler platform. We explored why large operational tables require partitioning, compared partitioning methods, designed monthly range partitions, tenant-aware partitioning, hybrid strategies, archival workflows, cold storage, partition maintenance, pruning, indexing, and SQL definitions. These techniques allow the platform to scale from millions to billions of records while maintaining high query performance and manageable operational costs.

---

# Next Chapter

**Filename:** `V2-C18-Complete-Database-Relationships-And-ERD.md`

**Chapter 18 — Complete Database Relationships & Entity Relationship Design**

The final chapter of Volume 2 will combine every schema designed so far into one complete database architecture. It will include the full Entity Relationship Diagram (ERD), schema boundaries, foreign-key relationships, cardinality, indexing philosophy, cross-service ownership, database naming conventions, and guidelines for implementing the entire PostgreSQL database in NestJS using Prisma or TypeORM.

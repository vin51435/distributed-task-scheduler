# Filename

**`V2-C14-System-Configuration-And-Feature-Flags.md`**

---

# Volume 2 — Database Design

# Chapter 14 — System Configuration & Feature Flags

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 14

**Filename:** `V2-C14-System-Configuration-And-Feature-Flags.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Runtime Configuration Exists
3. Configuration Architecture
4. Static vs Dynamic Configuration
5. Configuration Hierarchy
6. System Settings Table
7. Feature Flags Table
8. Retry Policies Table
9. Worker Configuration Table
10. Tenant Overrides
11. Configuration Reloading
12. Configuration Versioning
13. Query Patterns
14. Constraints & Indexes
15. Complete SQL
16. Future Evolution
17. Best Practices
18. Chapter Summary

---

# 14.1 Introduction

A production scheduler should **never require redeployment** for routine operational changes.

Examples:

- Increase worker concurrency
- Change retry policy
- Pause a feature rollout
- Reduce dispatch batch size
- Enable maintenance mode
- Disable webhook processing
- Limit tenant throughput

Hardcoding these values inside the application causes unnecessary deployments and operational risk.

Instead, runtime configuration is stored in the database and cached by services.

---

# 14.2 Why Runtime Configuration Exists

Bad approach:

```typescript
const MAX_RETRIES = 5;
const SCANNER_BATCH_SIZE = 500;
const WORKER_CONCURRENCY = 50;
```

Changing any value requires:

```text
Code Change

↓

Build

↓

Deploy

↓

Restart Services
```

Better approach:

```text
Database

↓

Configuration Service

↓

Redis Cache

↓

Running Services
```

Configuration changes become effective without code changes.

---

# 14.3 Configuration Architecture

```text
Administrator

↓

Configuration API

↓

PostgreSQL

↓

Redis Cache

↓

All Services

↓

Hot Reload
```

Every service periodically refreshes configuration or subscribes to configuration change events.

---

# 14.4 Static vs Dynamic Configuration

## Static Configuration

Stored in environment variables.

Examples:

- PostgreSQL connection string
- RabbitMQ URL
- Redis URL
- JWT Secret
- gRPC Ports

These require restart.

---

## Dynamic Configuration

Stored in PostgreSQL.

Examples:

- Retry limits
- Scanner interval
- Batch size
- Feature flags
- Tenant quotas

These can change while the system is running.

---

# 14.5 Configuration Hierarchy

Configuration is resolved in layers.

```text
Application Default

↓

Environment

↓

System Configuration

↓

Tenant Override

↓

Request Override
```

Example:

Default:

```text
Batch Size = 500
```

Tenant Override:

```text
Tenant A

↓

Batch Size = 100
```

Tenant A receives the overridden value.

All others use the system default.

---

# 14.6 System Settings Table

Table:

```text
config.system_settings
```

Stores global platform configuration.

---

## Columns

| Column      | Type             |
| ----------- | ---------------- |
| id          | UUID             |
| key         | VARCHAR(255)     |
| value       | JSONB            |
| category    | VARCHAR(100)     |
| description | TEXT             |
| data_type   | config_data_type |
| version     | INTEGER          |
| updated_by  | UUID             |
| updated_at  | TIMESTAMPTZ      |

---

## Examples

```text
scanner.batch_size
```

↓

```json
500
```

---

```text
dispatcher.max_batch
```

↓

```json
1000
```

---

```text
scheduler.default_retry
```

↓

```json
{
  "maxRetries": 5,
  "strategy": "EXPONENTIAL"
}
```

---

# 14.7 Feature Flags Table

Feature flags allow new functionality to be enabled gradually.

Table:

```text
config.feature_flags
```

---

## Examples

```text
distributed_scanner

↓

Enabled
```

```text
grpc_workers

↓

Disabled
```

```text
ai_retry_optimizer

↓

Disabled
```

---

## Columns

| Column             | Type        |
| ------------------ | ----------- |
| id                 | UUID        |
| flag_name          | VARCHAR     |
| enabled            | BOOLEAN     |
| rollout_percentage | INTEGER     |
| description        | TEXT        |
| created_at         | TIMESTAMPTZ |
| updated_at         | TIMESTAMPTZ |

---

## Gradual Rollout

Example:

```text
5%

↓

20%

↓

50%

↓

100%
```

Allows safe deployments.

---

# 14.8 Retry Policies Table

Instead of embedding retry policies inside jobs:

```text
config.retry_policies
```

---

## Columns

| Column           | Type           |
| ---------------- | -------------- |
| id               | UUID           |
| name             | VARCHAR        |
| max_retries      | INTEGER        |
| strategy         | retry_strategy |
| initial_delay_ms | INTEGER        |
| max_delay_ms     | INTEGER        |
| multiplier       | NUMERIC        |
| jitter           | BOOLEAN        |
| enabled          | BOOLEAN        |

---

Example:

```text
Default Email Retry
```

↓

```text
5 Retries

Exponential

Jitter Enabled
```

Workers reference policies by ID.

---

# 14.9 Worker Configuration

Workers may require independent settings.

Table:

```text
config.worker_settings
```

---

## Examples

```text
Email Worker

↓

Concurrency

25
```

PDF Worker:

```text
Concurrency

5
```

Image Processor:

```text
Concurrency

2
```

---

## Columns

| Column          | Type    |
| --------------- | ------- |
| id              | UUID    |
| worker_name     | VARCHAR |
| concurrency     | INTEGER |
| max_memory_mb   | INTEGER |
| timeout_seconds | INTEGER |
| enabled         | BOOLEAN |

---

# 14.10 Tenant Overrides

Enterprise customers often require custom configuration.

Example:

```text
Tenant A

↓

Retries = 10
```

Tenant B:

```text
Retries = 3
```

Rather than duplicating configuration:

Table:

```text
config.tenant_overrides
```

---

## Columns

| Column         | Type        |
| -------------- | ----------- |
| id             | UUID        |
| tenant_id      | UUID        |
| config_key     | VARCHAR     |
| override_value | JSONB       |
| created_at     | TIMESTAMPTZ |

---

# 14.11 Configuration Reloading

Services should not restart for every change.

Workflow:

```text
Admin

↓

Update Database

↓

Publish ConfigChanged Event

↓

Redis

↓

All Services Reload
```

Reload strategies:

- Poll every 30 seconds
- Listen to Redis Pub/Sub
- Listen to RabbitMQ event
- Watch PostgreSQL notifications

Redis Pub/Sub is recommended.

---

# 14.12 Configuration Versioning

Every configuration change increments a version.

Example:

```text
Version 1

↓

Scanner Batch = 500
```

↓

```text
Version 2

↓

Scanner Batch = 1000
```

Services compare versions before reloading.

---

# 14.13 Query Patterns

Read configuration:

```sql
SELECT *
FROM config.system_settings
WHERE key='scanner.batch_size';
```

Feature flags:

```sql
SELECT *
FROM config.feature_flags
WHERE enabled=TRUE;
```

Worker settings:

```sql
SELECT *
FROM config.worker_settings
WHERE worker_name='email-worker';
```

Tenant overrides:

```sql
SELECT *
FROM config.tenant_overrides
WHERE tenant_id=$1;
```

Retry policy:

```sql
SELECT *
FROM config.retry_policies
WHERE name='default';
```

---

# 14.14 Constraints

System Settings:

```sql
PRIMARY KEY(id)
```

Unique:

```sql
UNIQUE(key)
```

Feature Flags:

```sql
UNIQUE(flag_name)
```

Retry Policies:

```sql
CHECK(max_retries>=0)
```

Worker Settings:

```sql
CHECK(concurrency>0)
```

Tenant Overrides:

```sql
FOREIGN KEY(tenant_id)
REFERENCES identity.tenants(id)
```

---

# 14.15 Index Strategy

System Settings:

```text
(key)
```

Feature Flags:

```text
(flag_name)
```

Retry Policies:

```text
(name)
```

Worker Settings:

```text
(worker_name)
```

Tenant Overrides:

```text
(tenant_id)
```

Composite:

```text
(tenant_id, config_key)
```

---

# 14.16 Initial SQL Definition

## system_settings

```sql
CREATE TABLE config.system_settings (

    id UUID PRIMARY KEY,

    key VARCHAR(255) UNIQUE,

    value JSONB,

    category VARCHAR(100),

    description TEXT,

    data_type config_data_type,

    version INTEGER DEFAULT 1,

    updated_by UUID,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## feature_flags

```sql
CREATE TABLE config.feature_flags (

    id UUID PRIMARY KEY,

    flag_name VARCHAR(255) UNIQUE,

    enabled BOOLEAN,

    rollout_percentage INTEGER,

    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## retry_policies

```sql
CREATE TABLE config.retry_policies (

    id UUID PRIMARY KEY,

    name VARCHAR(255),

    max_retries INTEGER,

    strategy retry_strategy,

    initial_delay_ms INTEGER,

    max_delay_ms INTEGER,

    multiplier NUMERIC(10,2),

    jitter BOOLEAN,

    enabled BOOLEAN
);
```

---

## worker_settings

```sql
CREATE TABLE config.worker_settings (

    id UUID PRIMARY KEY,

    worker_name VARCHAR(255),

    concurrency INTEGER,

    max_memory_mb INTEGER,

    timeout_seconds INTEGER,

    enabled BOOLEAN
);
```

---

## tenant_overrides

```sql
CREATE TABLE config.tenant_overrides (

    id UUID PRIMARY KEY,

    tenant_id UUID
        REFERENCES identity.tenants(id),

    config_key VARCHAR(255),

    override_value JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 14.17 Configuration Categories

Example categories:

| Category      | Examples                            |
| ------------- | ----------------------------------- |
| Scheduler     | Batch size, scanner interval        |
| Dispatcher    | Publish batch size, confirm timeout |
| Worker        | Concurrency, timeout, memory        |
| Retry         | Default policies                    |
| Notification  | Email provider settings             |
| Security      | Rate limits, API quotas             |
| Feature Flags | Experimental features               |
| Tenant        | Overrides                           |

Grouping settings simplifies administration.

---

# 14.18 Operational Dashboard

Typical configuration dashboard:

| Metric                | Purpose                 |
| --------------------- | ----------------------- |
| Active Feature Flags  | Deployment visibility   |
| Configuration Version | Cache consistency       |
| Last Reload Time      | Health monitoring       |
| Tenant Overrides      | Enterprise management   |
| Disabled Workers      | Operational awareness   |
| Retry Policy Usage    | Configuration analytics |

---

# 14.19 Future Evolution

```text
Static Config

↓

Database Config

↓

Redis Cache

↓

Hot Reload

↓

Distributed Config Service

↓

Global Configuration Platform
```

As the platform grows, the configuration subsystem can evolve into a dedicated Configuration Service similar to those used at Google, Uber, or Netflix.

---

# 14.20 Best Practices

- Keep secrets in environment variables, not the database.
- Store operational settings in PostgreSQL.
- Cache configuration in Redis.
- Reload configuration without restarting services.
- Version configuration changes.
- Separate system defaults from tenant overrides.
- Use feature flags for gradual rollouts.
- Validate configuration before activation.
- Audit every configuration change.
- Keep configuration strongly typed.

---

# Chapter Summary

This chapter designed the runtime configuration system for the scheduler platform. We created tables for system settings, feature flags, retry policies, worker settings, and tenant-specific overrides. We explored configuration hierarchies, hot reloading, Redis caching, versioning, gradual feature rollouts, indexing strategies, and SQL definitions. By separating operational configuration from application code, the platform becomes easier to operate, safer to deploy, and more adaptable to changing production requirements.

---

# Next Chapter

**Filename:** `V2-C15-Identity-And-Multi-Tenant-Storage.md`

**Chapter 15 — Identity, Authentication & Multi-Tenant Database Design**

The next chapter will design the `identity` schema, including users, tenants, roles, permissions, API keys, OAuth clients, service accounts, JWT metadata, refresh tokens, RBAC, tenant isolation, and how authentication integrates with every service in the distributed scheduler platform.

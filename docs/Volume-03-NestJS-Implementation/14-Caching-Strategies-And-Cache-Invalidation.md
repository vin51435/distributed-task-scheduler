# Filename

**`V3-C14-Caching-Strategies-And-Cache-Invalidation.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 14 — Advanced Caching Strategies & Cache Invalidation

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 14

**Filename:** `V3-C14-Caching-Strategies-And-Cache-Invalidation.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Caching?
3. Cache Architecture
4. Cache-Aside Pattern
5. Read-Through Cache
6. Write-Through Cache
7. Write-Behind Cache
8. Cache Invalidation
9. TTL Design
10. Event-Driven Cache Updates
11. Cache Stampede
12. Hot Keys
13. Negative Caching
14. Cache Warming
15. Distributed Cache Synchronization
16. Performance Considerations
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 14.1 Introduction

Redis gives us an extremely fast in-memory data store.

However, simply storing data in Redis is **not** enough.

A cache must answer questions such as:

- What should be cached?
- How long should it remain cached?
- When should it expire?
- How should stale data be refreshed?
- How should multiple services stay synchronized?

This chapter designs the complete caching strategy for the scheduler platform.

---

# 14.2 Why Caching?

Suppose every Worker needs runtime configuration.

Without caching:

```text
Worker

↓

PostgreSQL

↓

Configuration
```

100 Workers:

```text
100 Workers

↓

1000 Reads/Second

↓

PostgreSQL
```

Most of those reads return identical data.

Instead:

```text
Worker

↓

Redis

↓

Memory
```

Database load decreases dramatically.

---

# 14.3 Cache Architecture

```text
              PostgreSQL

                   ▲

            Cache Miss

                   │

Worker ─────── Redis ─────── Scheduler

      │             │

      └─────────────┘

           Shared Cache
```

PostgreSQL remains the source of truth.

Redis accelerates reads.

---

# 14.4 Cache-Aside Pattern

This is the primary strategy used throughout the platform.

Workflow:

```text
Application

↓

Redis

↓

Hit?
```

YES:

```text
Return Cached Value
```

NO:

```text
Read PostgreSQL

↓

Store Redis

↓

Return Result
```

The application controls cache population.

---

# 14.5 Example

Worker requests retry policy.

```text
Worker

↓

Redis

↓

MISS
```

↓

```text
Configuration Service

↓

PostgreSQL
```

↓

```text
Redis

↓

Store

TTL 5 Minutes
```

↓

```text
Worker
```

Subsequent requests never touch PostgreSQL.

---

# 14.6 Read-Through Cache

Instead of the application loading data:

```text
Application

↓

Cache

↓

Database
```

The cache loads automatically.

Advantages:

- Simpler application logic

Disadvantages:

- Less control
- More infrastructure complexity

For our scheduler we prefer **Cache-Aside**.

---

# 14.7 Write-Through Cache

Workflow:

```text
Application

↓

Redis

↓

PostgreSQL
```

Both update together.

Advantages:

- Cache always current

Disadvantages:

- Higher write latency

Useful for:

- Frequently read reference data

---

# 14.8 Write-Behind Cache

Workflow:

```text
Application

↓

Redis

↓

Immediate Success
```

Later:

```text
Redis

↓

Background Sync

↓

PostgreSQL
```

Advantages:

- Extremely fast writes

Disadvantages:

- Possible data loss

We **do not** use this pattern for scheduler state because durability is critical.

---

# 14.9 What Gets Cached?

Suitable candidates:

```text
Runtime Configuration

Feature Flags

Tenant Settings

Notification Templates

User Permissions

Retry Policies

Rate Limits
```

Avoid caching:

```text
Execution History

Audit Logs

Job Results

Active Transactions
```

Those remain in PostgreSQL.

---

# 14.10 Cache Keys

Keys should follow a consistent naming convention.

Examples:

```text
config:tenant:42

config:retry

feature:notifications

template:email:welcome

permission:user:100

tenant:42
```

Benefits:

- Easy debugging
- Bulk invalidation
- Monitoring

---

# 14.11 TTL Design

Every cached item should have an expiration.

Example:

| Data                   | TTL        |
| ---------------------- | ---------- |
| Retry Policy           | 5 minutes  |
| Feature Flags          | 1 minute   |
| User Permissions       | 10 minutes |
| Notification Templates | 30 minutes |
| Tenant Configuration   | 5 minutes  |

TTL depends on how frequently the data changes.

---

# 14.12 Why TTL Exists

Without TTL:

```text
Configuration

↓

Cached

↓

Forever
```

Configuration changes.

Workers still use old values.

With TTL:

```text
5 Minutes

↓

Expire

↓

Reload
```

Eventually consistency is restored.

---

# 14.13 Event-Driven Cache Invalidation

TTL alone is not enough.

Suppose an administrator changes retry policy.

Waiting five minutes is unacceptable.

Instead:

```text
Configuration Updated

↓

Redis Pub/Sub

↓

All Services

↓

Invalidate Cache
```

Changes propagate immediately.

---

# 14.14 Invalidation Flow

```text
Administrator

↓

Configuration Service

↓

PostgreSQL

↓

Redis Cache

↓

Publish Event

↓

Workers

↓

Scheduler

↓

Notification

↓

Refresh
```

No polling required.

---

# 14.15 Cache Stampede

Suppose cache expires.

100 workers request the same key simultaneously.

Without protection:

```text
100 Workers

↓

Redis MISS

↓

100 Database Queries
```

Database spike.

---

# 14.16 Preventing Stampede

One process reloads.

Others wait.

```text
Worker

↓

Acquire Lock

↓

Reload Database

↓

Update Cache
```

Remaining workers:

```text
Wait

↓

Read Cache
```

Only one database query occurs.

---

# 14.17 Hot Keys

Some cache entries receive enormous traffic.

Example:

```text
Global Configuration
```

Millions of reads.

Redis node becomes overloaded.

Mitigation:

- Replicas
- Local in-memory cache
- Sharding
- Request batching

Monitor hot keys continuously.

---

# 14.18 Negative Caching

Sometimes "not found" is also valuable.

Example:

```text
Unknown Tenant
```

Instead of querying PostgreSQL repeatedly:

```text
MISS

↓

Store NULL

↓

TTL 30 Seconds
```

Repeated invalid requests never reach PostgreSQL.

---

# 14.19 Cache Warming

Application startup:

```text
Scheduler

↓

Preload

↓

Configuration

↓

Templates

↓

Feature Flags
```

Critical data enters cache before traffic arrives.

Benefits:

- Faster startup
- Reduced cache misses
- Stable latency

---

# 14.20 Distributed Cache Synchronization

Multiple services share Redis.

```text
Scheduler

Worker

Notification

↓

Redis
```

Configuration changes.

Redis Pub/Sub broadcasts:

```text
Invalidate

↓

Refresh
```

Every instance receives identical updates.

---

# 14.21 Local Memory Cache

Frequently accessed values may also be cached locally.

```text
Application

↓

Memory

↓

Redis

↓

PostgreSQL
```

Flow:

```text
Memory Hit?

↓

YES

↓

Return
```

Otherwise:

```text
Redis

↓

Database
```

This creates a multi-level cache.

---

# 14.22 Cache Layers

```text
Application Memory

↓

Redis

↓

PostgreSQL
```

Latency comparison:

| Layer      | Typical Latency |
| ---------- | --------------- |
| Memory     | <1 µs           |
| Redis      | <1 ms           |
| PostgreSQL | 2–20 ms         |

Always check the fastest layer first.

---

# 14.23 Scheduler Example

Worker requests runtime configuration.

```text
Worker

↓

Memory Cache

↓

MISS

↓

Redis

↓

MISS

↓

Configuration Service

↓

PostgreSQL

↓

Redis

↓

Memory

↓

Worker
```

Subsequent requests use memory.

---

# 14.24 Cache Monitoring

Useful metrics:

```text
Cache Hit Rate

Cache Miss Rate

Evictions

TTL Expirations

Memory Usage

Key Count

Hot Keys

Invalidations
```

Prometheus continuously collects these metrics.

---

# 14.25 Complete Cache Architecture

```text
                Applications

         ┌────────┼─────────┐

         ▼        ▼         ▼

    Scheduler   Worker   Notification

         │        │         │

         ▼        ▼         ▼

      Local Memory Cache

                │

                ▼

             Redis Cache

                │

          Cache Miss

                ▼

           PostgreSQL
```

This layered approach minimizes latency while preserving consistency.

---

# 14.26 Performance Considerations

Recommendations:

- Cache only frequently read data.
- Avoid caching rapidly changing entities.
- Use consistent key naming.
- Keep TTLs appropriate.
- Use event-driven invalidation.
- Prevent cache stampedes with distributed locks.
- Monitor hit rates.
- Warm caches during startup.
- Avoid oversized cached objects.
- Periodically review cache effectiveness.

---

# 14.27 Future Evolution

Current:

```text
Redis Cache
```

↓

Future:

```text
Redis Cluster
```

↓

```text
Near Cache
```

↓

```text
Distributed Cache Manager
```

↓

```text
Geo-Replicated Cache
```

↓

```text
Multi-Level Adaptive Cache
```

The caching layer evolves independently from application logic.

---

# 14.28 Best Practices

- Use Cache-Aside as the default strategy.
- Keep PostgreSQL as the source of truth.
- Use TTLs on all cache entries.
- Invalidate caches using events instead of polling.
- Prevent cache stampedes.
- Cache "not found" responses where appropriate.
- Warm critical caches during startup.
- Monitor cache performance continuously.
- Design cache keys consistently.
- Keep cached values small and immutable where possible.

---

# Chapter Summary

This chapter designed the caching architecture for the Distributed Task Scheduler Platform. We explored Cache-Aside, Read-Through, Write-Through, and Write-Behind strategies, defined TTL policies, event-driven cache invalidation, cache stampede prevention, hot-key mitigation, negative caching, cache warming, and multi-level caching with local memory and Redis. These strategies enable low-latency access to shared data while protecting PostgreSQL from unnecessary load.

---

# Next Chapter

**Filename:** `V3-C15-Observability-Logging-Metrics-And-Tracing.md`

**Chapter 15 — Observability: Logging, Metrics, Distributed Tracing & Monitoring**

The next chapter will build the platform's observability stack. We will design a shared `ObservabilityModule` using **Pino**, **OpenTelemetry**, **Prometheus**, **Grafana**, **Jaeger**, and structured logging. We will implement distributed tracing across HTTP, gRPC, RabbitMQ, and Redis, expose metrics, propagate trace context, build dashboards, define SLIs/SLOs, configure alerts, and make the scheduler fully observable in production.

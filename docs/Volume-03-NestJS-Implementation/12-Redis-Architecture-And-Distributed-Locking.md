# Filename

**`V3-C12-Redis-Architecture-And-Distributed-Locking.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 12 — Redis Architecture, Caching & Distributed Locking

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 12

**Filename:** `V3-C12-Redis-Architecture-And-Distributed-Locking.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Redis?
3. Redis Responsibilities
4. Redis Architecture
5. Shared Redis Module
6. Connection Management
7. Caching
8. Distributed Locking
9. Lease Mechanism
10. Leader Election
11. Pub/Sub
12. Runtime Configuration Cache
13. Rate Limiting
14. Lua Scripts
15. Health Checks
16. Performance
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 12.1 Introduction

Our scheduler already uses:

- PostgreSQL
- RabbitMQ
- gRPC

Each technology has a different responsibility.

| Technology | Responsibility                    |
| ---------- | --------------------------------- |
| PostgreSQL | Persistent storage                |
| RabbitMQ   | Asynchronous messaging            |
| gRPC       | Service-to-service RPC            |
| Redis      | Fast shared memory & coordination |

Redis is **not** our primary database.

Redis acts as the **coordination layer** between distributed services.

---

# 12.2 Why Redis?

Imagine every worker querying PostgreSQL for every operation.

```text
Worker

↓

SELECT Configuration

↓

PostgreSQL
```

100 workers:

```text
100 Workers

↓

1000 Queries/Second

↓

PostgreSQL
```

Eventually PostgreSQL becomes overloaded.

Instead:

```text
Worker

↓

Redis

↓

Memory

↓

0.5 ms
```

Redis dramatically reduces database load.

---

# 12.3 Redis Responsibilities

In our scheduler Redis is responsible for:

- Distributed locks
- Runtime configuration cache
- Rate limiting
- Leader election
- Temporary state
- Idempotency cache
- Pub/Sub
- Fast lookups
- Session-like data
- Coordination

Redis **does not** store permanent business data.

---

# 12.4 Overall Architecture

```text
                PostgreSQL

                     ▲

                     │

              Cache Miss

                     │

Worker ─────── Redis ─────── Scheduler

      │             │              │

      └─────────────┼──────────────┘

              Distributed State
```

PostgreSQL remains the source of truth.

Redis accelerates access.

---

# 12.5 Shared Redis Module

Project:

```text
packages/

redis/

├── src/

│

├── cache/

├── locks/

├── pubsub/

├── limiter/

├── scripts/

├── leader/

├── config/

├── metrics/

├── health/

├── interfaces/

├── decorators/

├── utils/

└── redis.module.ts
```

All Redis functionality belongs here.

---

# 12.6 RedisModule

Every service imports:

```typescript
RedisModule;
```

Responsibilities:

- Create Redis connection
- Cache abstraction
- Lock manager
- Pub/Sub
- Rate limiter
- Runtime configuration
- Metrics
- Health checks

Applications never use Redis clients directly.

---

# 12.7 Connection Management

Each service owns one Redis connection.

```text
Application

↓

RedisModule

↓

Redis Connection

↓

Redis Server
```

Rules:

- One connection per service instance
- Automatic reconnect
- Graceful shutdown
- Shared connection pool

---

# 12.8 Caching

Redis acts as a cache.

Workflow:

```text
Worker

↓

Redis

↓

Found?

↓

YES

↓

Return
```

Otherwise:

```text
Worker

↓

Redis

↓

MISS

↓

PostgreSQL

↓

Redis

↓

Return
```

This is called the **Cache-Aside Pattern**.

---

# 12.9 What Gets Cached?

Examples:

```text
Runtime Configuration

Tenant Settings

Notification Templates

Rate Limits

Feature Flags

User Permissions

Retry Policies
```

Do **not** cache:

- Execution history
- Audit logs
- Jobs currently being updated

Only cache data that benefits from repeated reads.

---

# 12.10 Distributed Locking

Suppose two Scheduler instances run simultaneously.

Both discover the same bucket.

```text
Scheduler A

↓

Bucket #42
```

```text
Scheduler B

↓

Bucket #42
```

Without coordination:

Both dispatch identical jobs.

Duplicate execution.

Instead:

```text
Redis Lock

↓

Only One Scheduler Wins
```

---

# 12.11 Lock Flow

```text
Scheduler

↓

Acquire Lock

↓

Success?

↓

YES

↓

Process Bucket

↓

Release Lock
```

If acquisition fails:

```text
Another Instance Owns Lock
```

The scheduler simply skips the bucket.

---

# 12.12 Lease Mechanism

Locks should never live forever.

Instead:

```text
Acquire Lock

↓

TTL

30 Seconds
```

If the scheduler crashes:

```text
TTL Expires

↓

Lock Released
```

Another scheduler instance can continue processing.

This prevents permanent deadlocks.

---

# 12.13 Lease Renewal

Long-running tasks renew leases.

```text
Acquire Lock

↓

15 Seconds

↓

Renew

↓

15 Seconds

↓

Renew
```

If renewal stops:

The lease naturally expires.

---

# 12.14 Leader Election

Some tasks should only run once.

Example:

```text
Scanner
```

If five Scanner instances exist:

```text
Scanner A

Scanner B

Scanner C

Scanner D

Scanner E
```

Only one should scan buckets.

Redis elects one leader.

---

# 12.15 Leader Election Flow

```text
Scanner

↓

Acquire Leader Lock

↓

Winner?

↓

YES

↓

Become Leader
```

Others:

```text
Standby
```

If the leader crashes:

TTL expires.

Another instance becomes leader.

---

# 12.16 Pub/Sub

Redis also supports Publish/Subscribe.

Example:

```text
Configuration Updated

↓

Redis Pub/Sub

↓

Worker

↓

Scheduler

↓

Notification

↓

Monitoring
```

All services refresh cached configuration immediately.

---

# 12.17 Runtime Configuration Cache

Configuration Service:

```text
Database

↓

Redis

↓

Publish Event
```

Worker:

```text
Receive Event

↓

Refresh Cache
```

No polling required.

---

# 12.18 Idempotency Cache

Workers process RabbitMQ messages.

A duplicate message may arrive.

Workflow:

```text
Receive Message

↓

Redis

↓

Message ID Exists?

↓

YES

↓

ACK

↓

Done
```

Otherwise:

```text
Process

↓

Store Message ID

↓

TTL

24 Hours
```

This prevents duplicate processing.

---

# 12.19 Rate Limiting

API Gateway:

```text
Incoming Request

↓

Redis Counter

↓

Limit Exceeded?

↓

YES

↓

429
```

Redis provides atomic counters.

Perfect for distributed rate limiting.

---

# 12.20 Lua Scripts

Some operations require atomicity.

Example:

```text
Acquire Lock

+

Set TTL
```

Should happen together.

Redis Lua Script:

```text
Check

↓

Set

↓

Expire

↓

Return
```

No race condition.

Other uses:

- Token bucket
- Sliding window
- Lock renewal
- Counter updates

---

# 12.21 Health Checks

Redis health verifies:

```text
Ping

↓

Latency

↓

Memory

↓

Connected Clients

↓

Replication
```

Health endpoint:

```text
UP

or

DOWN
```

Monitoring continuously checks Redis connectivity.

---

# 12.22 Metrics

Examples:

```text
Cache Hit Rate

Cache Miss Rate

Lock Acquisition Time

Lock Contention

Pub/Sub Events

Redis Latency

Commands Per Second

Memory Usage
```

Prometheus collects these metrics.

---

# 12.23 Scheduler Example

Complete bucket acquisition:

```text
Scanner

↓

Redis Lock

↓

Bucket

↓

Expand Jobs

↓

Dispatcher

↓

Release Lock
```

If another scanner already owns the lock:

```text
Acquire

↓

Failed

↓

Skip Bucket
```

This guarantees that only one scanner expands each bucket.

---

# 12.24 Cache Invalidation

Cached data eventually becomes stale.

Strategies:

### Time-Based

```text
TTL

↓

5 Minutes
```

---

### Event-Based

```text
Configuration Changed

↓

Invalidate Cache
```

---

### Manual

```text
Administrator

↓

Flush Cache
```

The scheduler primarily uses **event-based invalidation**.

---

# 12.25 Complete Redis Architecture

```text
                    Applications

        ┌────────────┼─────────────┐

        ▼            ▼             ▼

   Scheduler      Worker     Notification

        │            │             │

        └────────────┼─────────────┘

                     ▼

               RedisModule

      ┌────────┼────────┬────────┐

      ▼        ▼        ▼        ▼

 Cache    Locks   Pub/Sub   Rate Limit

      │

      ▼

                Redis Cluster
```

Redis provides shared state without becoming the primary database.

---

# 12.26 Performance Considerations

Recommendations:

- Keep cached objects small.
- Use sensible TTL values.
- Avoid storing large blobs.
- Use event-driven cache invalidation.
- Minimize lock duration.
- Renew leases only when necessary.
- Batch Redis commands where possible.
- Monitor memory usage.
- Use Lua scripts for atomic operations.
- Avoid unnecessary network round trips.

---

# 12.27 Future Evolution

Current:

```text
Single Redis
```

↓

Future:

```text
Redis Sentinel
```

↓

```text
Redis Cluster
```

↓

```text
Multi-Region Redis
```

↓

```text
Geo Replication
```

↓

```text
Sharded Cache
```

↓

```text
High Availability Coordination Layer
```

The shared Redis module hides infrastructure complexity from application code.

---

# 12.28 Best Practices

- Use Redis for coordination, not permanent storage.
- Centralize access through a shared `RedisModule`.
- Cache frequently read data.
- Use distributed locks with TTLs.
- Renew leases only while work is active.
- Use leader election for singleton tasks.
- Use Pub/Sub for cache invalidation.
- Store idempotency keys with expiration.
- Implement distributed rate limiting with Redis counters.
- Use Lua scripts for atomic multi-step operations.

---

# Chapter Summary

This chapter designed the Redis infrastructure for the Distributed Task Scheduler Platform. We introduced a reusable `RedisModule`, centralized connection management, implemented cache-aside caching, distributed locking with leases, leader election, Pub/Sub, runtime configuration caching, idempotency tracking, rate limiting, Lua scripts, health checks, and metrics. Redis now serves as the platform's high-speed coordination layer, enabling distributed services to cooperate safely and efficiently without overloading PostgreSQL.

---

# Next Chapter

**Filename:** `V3-C13-Distributed-Locks-Leases-And-Leader-Election.md`

**Chapter 13 — Implementing Distributed Locks, Leases & Leader Election in NestJS**

The next chapter will move from Redis architecture to implementation. We will build a production-grade distributed lock service, lease renewal mechanism, automatic lock expiration, leader election, fencing tokens, lock contention handling, failure recovery, and integrate these primitives into the Scanner, Dispatcher, and Worker services to coordinate execution safely across multiple nodes.

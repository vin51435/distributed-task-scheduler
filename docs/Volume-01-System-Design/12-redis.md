# Chapter 12 — Redis Design & Distributed Coordination

**Document:** Distributed Task Scheduler Platform
**Chapter:** 12
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Redis?
3. Redis Responsibilities
4. Redis Architecture
5. Data Structures
6. Distributed Locks
7. Distributed Leases
8. Leader Election
9. Heartbeats
10. Rate Limiting
11. Caching
12. Idempotency Storage
13. Failure Detection
14. Redis Persistence
15. High Availability
16. Migration to etcd
17. Chapter Summary

---

# 12.1 Introduction

Redis is an **in-memory data store** that serves multiple roles within the scheduler.

Unlike PostgreSQL, Redis is **not the source of truth** for scheduled jobs.

Instead, Redis provides:

- Fast distributed coordination
- Temporary caching
- Leader election
- Distributed leases
- Heartbeats
- Rate limiting
- Idempotency storage

Redis enables multiple instances of the same service to coordinate their work without relying on slow database operations.

---

# 12.2 Why Redis?

The scheduler frequently performs operations that require extremely low latency.

Examples include:

- Acquiring scanner ownership
- Renewing leases
- Checking rate limits
- Reading cached configuration
- Coordinating workers

Redis performs these operations in microseconds because all data resides in memory.

---

## Advantages

- Extremely fast
- Atomic commands
- TTL support
- Rich data structures
- Pub/Sub support
- Mature ecosystem

---

## Disadvantages

- Memory limited
- Data may be lost without persistence
- Not suitable as the primary database

---

# 12.3 Redis Responsibilities

Redis stores **temporary operational state**.

It does **not** store:

- Scheduled jobs
- Audit history
- Permanent business data

Redis is responsible for:

- Distributed locks
- Scanner leases
- Leader election
- Heartbeats
- Rate limiting
- Idempotency keys
- Frequently accessed configuration
- Short-lived cache

---

# 12.4 Redis Architecture

```text
                 Redis

        ┌────────┼────────┐

        │        │        │

Coordinator Scanner Worker

        │

        ▼

     Timer Service
```

All services access Redis independently.

PostgreSQL remains the system of record.

---

# 12.5 Data Structures

Redis provides several data structures.

| Structure  | Scheduler Usage                     |
| ---------- | ----------------------------------- |
| String     | Locks, leases, configuration        |
| Hash       | Service metadata                    |
| Set        | Active workers                      |
| Sorted Set | Delayed retry tracking (future use) |
| List       | Temporary queues (rarely used)      |
| Pub/Sub    | Internal notifications (optional)   |

---

## Example Keys

```text
lease:bucket:17

leader:scanner

heartbeat:worker:12

rate:user:456

idempotency:550e8400

cache:config
```

Consistent key naming simplifies operations and monitoring.

---

# 12.6 Distributed Locks

A distributed lock ensures that only one service performs a critical operation.

Example:

```text
Scanner A

↓

Acquire Lock

↓

Success
```

```text
Scanner B

↓

Acquire Lock

↓

Fail
```

Only Scanner A proceeds.

---

## Redis Implementation

Atomic command:

```text
SET lock:scanner unique-id NX PX 30000
```

Where:

- `NX` = only create if absent
- `PX` = expire automatically after 30 seconds

Automatic expiration prevents permanent deadlocks if the owner crashes.

---

# 12.7 Distributed Leases

Locks are short-lived.

A **lease** extends ownership over time.

Example:

```text
Scanner

↓

Acquire Lease

↓

30 Seconds

↓

Renew Lease

↓

30 Seconds

↓

Renew Again
```

If renewal stops:

```text
Lease

↓

Expires

↓

Ownership Released
```

Another scanner may safely acquire the lease.

---

# 12.8 Leader Election

Some operations should be executed by only one instance.

Examples:

- Cron schedule generation
- Cleanup tasks
- Metrics aggregation

Leader election uses Redis.

```text
Cron A

↓

Acquire Leader Lock

↓

Leader
```

```text
Cron B

↓

Lock Exists

↓

Follower
```

If the leader crashes:

```text
Lease Expires

↓

Follower Becomes Leader
```

---

# 12.9 Heartbeats

Each service periodically reports that it is alive.

Example:

```text
Worker

↓

Heartbeat

↓

Redis

↓

TTL Reset
```

Keys:

```text
heartbeat:worker:1

heartbeat:worker:2

heartbeat:scanner:3
```

If heartbeats stop:

```text
TTL

↓

Expires

↓

Service Considered Dead
```

---

# 12.10 Rate Limiting

The API limits client requests using Redis.

Example policy:

```text
100 requests/minute
```

Flow:

```text
API

↓

Redis Counter

↓

Below Limit?

↓

Yes → Continue

No → HTTP 429
```

Example key:

```text
rate:user:123
```

TTL automatically resets the counter after one minute.

---

# 12.11 Caching

Redis caches frequently accessed information.

Examples:

- Configuration
- Feature flags
- User permissions
- Scheduler metadata

Example:

```text
API

↓

Redis Cache

↓

Hit?

↓

Yes

↓

Return Data
```

Cache miss:

```text
Redis Miss

↓

Database

↓

Store in Redis

↓

Return
```

---

# 12.12 Idempotency Storage

Clients submit an idempotency key.

```http
Idempotency-Key:
550e8400-e29b
```

Redis stores:

```text
idempotency:550e8400

↓

Job ID

↓

Expiration Time
```

Repeated requests return the original response instead of creating duplicate jobs.

TTL automatically removes expired keys.

---

# 12.13 Failure Detection

Redis supports failure detection using TTL.

Example:

```text
Worker

↓

Heartbeat

↓

Redis
```

Crash:

```text
Worker Stops

↓

TTL Expires

↓

Coordinator Detects Failure
```

The Coordinator can then:

- Reassign scanner buckets
- Elect a new leader
- Trigger alerts

---

# 12.14 Redis Persistence

Redis is primarily an in-memory database.

Persistence options:

---

## RDB Snapshots

Periodic snapshots.

Advantages:

- Small files
- Fast restart

Disadvantages:

- Recent writes may be lost

---

## Append Only File (AOF)

Every write is logged.

Advantages:

- Better durability

Disadvantages:

- Larger storage
- Slightly slower writes

---

## Scheduler Recommendation

Development:

```text
RDB
```

Production:

```text
AOF + RDB
```

This balances durability and recovery speed.

---

# 12.15 High Availability

Initial deployment:

```text
Redis

↓

Single Instance
```

As traffic grows:

```text
Redis Sentinel

↓

Primary

↓

Replica 1

↓

Replica 2
```

Eventually:

```text
Redis Cluster

↓

Automatic Sharding
```

---

# 12.16 Failure Scenarios

## Redis Restart

```text
Redis Restarts

↓

Leases Lost

↓

Scanners Reacquire Ownership
```

Because PostgreSQL stores the jobs, no scheduled work is lost.

---

## Leader Crash

```text
Leader

↓

Heartbeat Stops

↓

Lease Expires

↓

New Leader
```

---

## Scanner Crash

```text
Lease Expires

↓

Bucket Released

↓

Another Scanner Claims Bucket
```

---

## Network Partition

```text
Scanner

↓

Cannot Reach Redis

↓

Lease Expires

↓

Ownership Lost

↓

Reconnect

↓

Acquire New Lease
```

This prevents split-brain ownership.

---

# 12.17 Migration to etcd

Redis provides lightweight coordination.

As the scheduler scales, stronger consistency may become necessary.

Evolution:

```text
Phase 1

Redis
```

↓

```text
Phase 2

Redis Sentinel
```

↓

```text
Phase 3

Redis Cluster
```

↓

```text
Phase 4

etcd
```

Why migrate?

| Redis                | etcd                                |
| -------------------- | ----------------------------------- |
| Fast                 | Strongly consistent                 |
| Simple               | Raft consensus                      |
| TTL                  | Native leases                       |
| Basic coordination   | Distributed consensus               |
| Good for development | Better for production control plane |

Only the **Coordinator Service** changes.

The rest of the platform remains unaffected because all coordination logic is encapsulated behind the Coordinator's gRPC interface.

---

# 12.18 Redis Best Practices

The scheduler follows these guidelines:

- Never store permanent business data.
- Always set TTL for temporary keys.
- Use atomic Redis commands for coordination.
- Keep values small.
- Use consistent key prefixes.
- Avoid long-running Lua scripts.
- Monitor memory usage.
- Use persistence in production.
- Handle Redis outages gracefully.
- Treat Redis as a coordination layer, not a primary database.

---

# 12.19 Redis Key Summary

| Key Pattern                | Purpose                      | TTL          |
| -------------------------- | ---------------------------- | ------------ |
| `lease:bucket:{id}`        | Scanner ownership            | 30 sec       |
| `leader:cron`              | Leader election              | 30 sec       |
| `heartbeat:{service}:{id}` | Service liveness             | 15 sec       |
| `rate:user:{id}`           | Rate limiting                | 60 sec       |
| `idempotency:{key}`        | Duplicate request prevention | 24 hr        |
| `cache:config:{name}`      | Cached configuration         | Configurable |

---

# Chapter Summary

This chapter designed Redis as the distributed coordination layer for the Distributed Task Scheduler Platform. We examined how Redis provides distributed locks, leases, leader election, heartbeats, rate limiting, caching, idempotency storage, and failure detection while leaving permanent scheduling data in PostgreSQL. We also explored persistence options, high-availability configurations, common failure scenarios, and the evolution from Redis-based coordination to etcd for stronger consistency in large-scale production deployments.

---

# Next Chapter

**Chapter 13 — RabbitMQ Design & Message Broker Architecture**

The next chapter focuses on RabbitMQ as the execution backbone of the scheduler. It will cover exchanges, queues, bindings, routing keys, message lifecycle, acknowledgements, retries, dead-letter queues, delayed delivery, consumer scaling, publisher confirms, flow control, and how RabbitMQ reliably connects the Timing Plane with the Execution Plane.

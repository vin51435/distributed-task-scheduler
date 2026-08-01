# Chapter 22 — Distributed Coordination & Leader Election

**Document:** Distributed Task Scheduler Platform
**Chapter:** 22
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Distributed Coordination?
3. Design Goals
4. Coordination Architecture
5. Core Coordination Components
6. Leader Election
7. Distributed Leases
8. Bucket Ownership
9. Heartbeats
10. Failure Detection
11. Split-Brain Prevention
12. Failure Recovery
13. Performance Optimization
14. Future Evolution
15. Best Practices
16. Chapter Summary

---

# 22.1 Introduction

As the scheduler scales horizontally, multiple instances of the same service run simultaneously.

Examples include:

- Scanner Service
- Cron Service
- Dispatcher Service
- Worker Service

Without coordination, multiple instances could process the same work concurrently, resulting in duplicate job generation, duplicate dispatch, or inconsistent state.

The **Distributed Coordination System** ensures that work is safely divided among multiple instances while maintaining high availability and fault tolerance.

---

# 22.2 Why Distributed Coordination?

Consider three Scanner instances.

```text
Scanner A

Scanner B

Scanner C
```

Without coordination:

```text
Scanner A

↓

Promote Job #42

Scanner B

↓

Promote Job #42

Scanner C

↓

Promote Job #42
```

The same job is promoted three times.

Instead:

```text
Scanner A

↓

Owns Bucket 1

Scanner B

↓

Owns Bucket 2

Scanner C

↓

Owns Bucket 3
```

Every piece of work has exactly one active owner.

---

# 22.3 Design Goals

The coordination system is designed to provide:

- High availability
- Fault tolerance
- Automatic failover
- Horizontal scalability
- Fast recovery
- No single point of failure
- Minimal coordination overhead
- Safe ownership transfer

---

# 22.4 Coordination Architecture

```text
            PostgreSQL

                 │

         Job Metadata

                 │

         Coordinator Service

                 │

              Redis

        (Locks & Leases)

     ┌─────────┼─────────┐

     │         │         │

 Scanner   Cron Service  Dispatcher

     │         │         │

     └─────────┼─────────┘
```

Redis acts as the coordination layer.

PostgreSQL remains the source of truth for business data.

---

# 22.5 Core Coordination Components

The Coordinator Service manages:

| Component         | Purpose                  |
| ----------------- | ------------------------ |
| Leader Election   | Select active leader     |
| Distributed Locks | Mutual exclusion         |
| Leases            | Temporary ownership      |
| Bucket Ownership  | Partition workload       |
| Heartbeats        | Detect healthy instances |
| Failover          | Reassign ownership       |
| Membership        | Track active nodes       |

These mechanisms enable multiple scheduler instances to cooperate safely.

---

# 22.6 Leader Election

Some responsibilities require a single active leader.

Examples:

- Cluster initialization
- Bucket assignment
- Coordination metadata updates

Election process:

```text
Node A

↓

Acquire Leader Lease

↓

Leader
```

Other nodes:

```text
Node B

↓

Leader Exists

↓

Follower
```

Only one leader exists at a time.

---

## Leader Responsibilities

The leader:

- Assigns buckets
- Monitors cluster membership
- Detects failures
- Rebalances ownership
- Coordinates failover

The leader does **not** execute user jobs.

---

# 22.7 Distributed Leases

Unlike permanent locks, leases automatically expire.

Example:

```text
Lease

↓

30 Seconds

↓

Renew

↓

30 Seconds

↓

Renew
```

If renewal stops:

```text
Lease

↓

Expires

↓

Ownership Released
```

This prevents resources from remaining locked after crashes.

---

# 22.8 Bucket Ownership

Instead of every Scanner reading every job:

```text
Scanner A

↓

Buckets 1–100
```

```text
Scanner B

↓

Buckets 101–200
```

```text
Scanner C

↓

Buckets 201–300
```

Each Scanner processes only its assigned buckets.

Ownership is stored in Redis using leases.

---

## Rebalancing

When a new node joins:

```text
Scanner D

↓

Receive Buckets

↓

Cluster Balanced
```

When a node leaves:

```text
Scanner B

↓

Offline

↓

Buckets Reassigned
```

---

# 22.9 Heartbeats

Every instance periodically sends a heartbeat.

```text
Scanner A

↓

Heartbeat

↓

Coordinator
```

Example interval:

```text
Every 10 Seconds
```

The Coordinator updates the node's last-seen timestamp.

---

# 22.10 Failure Detection

Missing heartbeats indicate failure.

```text
Heartbeat

↓

Missing

↓

Lease Timeout

↓

Node Failed
```

The Coordinator immediately begins failover.

Failure detection is based on lease expiration rather than explicit shutdown messages.

---

# 22.11 Split-Brain Prevention

Split-brain occurs when multiple nodes believe they own the same resource.

Example:

```text
Scanner A

↓

Leader
```

and simultaneously:

```text
Scanner B

↓

Leader
```

This must never happen.

The scheduler prevents split-brain through:

- Atomic lease acquisition
- Lease expiration
- Fencing tokens
- Single ownership validation

Every ownership change is verified before processing begins.

---

# 22.12 Failure Recovery

## Leader Failure

```text
Leader

↓

Crash

↓

Lease Expires

↓

Follower

↓

New Leader
```

Leadership transfers automatically.

---

## Scanner Failure

```text
Scanner

↓

Lease Lost

↓

Buckets Released

↓

Reassigned
```

No manual intervention is required.

---

## Redis Restart

```text
Redis

↓

Restart

↓

Reconnect

↓

Rebuild Ownership
```

Ownership information is reconstructed from active nodes.

---

## Network Partition

```text
Node

↓

Cannot Renew Lease

↓

Lease Expires

↓

Stops Processing
```

A node without a valid lease never continues processing work.

---

# 22.13 Performance Optimization

## Lease Renewal

Renew leases instead of repeatedly acquiring new ones.

---

## Lightweight Heartbeats

Heartbeats contain only operational metadata.

Avoid unnecessary payload.

---

## Partitioned Ownership

Assign ranges of buckets instead of individual jobs.

This significantly reduces coordination traffic.

---

## Lazy Rebalancing

Ownership changes occur only when necessary.

Examples:

- Node joins
- Node leaves
- Leader changes

Normal operation requires minimal coordination.

---

# 22.14 Future Evolution

### Phase 1

```text
Single Scheduler
```

↓

### Phase 2

```text
Redis Leases
```

↓

### Phase 3

```text
Leader Election
```

↓

### Phase 4

```text
Dynamic Bucket Rebalancing
```

↓

### Phase 5

```text
etcd-Based Coordination
```

Redis provides an efficient coordination layer during early deployments.

As cluster size and operational requirements grow, coordination can migrate to etcd, which offers stronger consistency guarantees and richer distributed coordination primitives.

---

# 22.15 Coordination Best Practices

The Distributed Coordination System follows these principles:

- Use leases instead of permanent locks.
- Keep lease durations short.
- Renew leases frequently.
- Never process work without ownership.
- Separate coordination data from business data.
- Partition work into buckets.
- Use automatic failover.
- Prevent split-brain through atomic lease acquisition.
- Minimize coordination traffic.
- Continuously monitor cluster health.

---

# 22.16 Coordination Metrics

| Metric               | Purpose                  |
| -------------------- | ------------------------ |
| Active Nodes         | Cluster size             |
| Leader Changes       | Cluster stability        |
| Lease Renewals       | Ownership health         |
| Lease Expirations    | Failure detection        |
| Heartbeat Latency    | Network health           |
| Bucket Reassignments | Cluster balancing        |
| Failover Duration    | Recovery speed           |
| Split-Brain Events   | Coordination correctness |

These metrics provide visibility into cluster stability and coordination performance.

---

# Chapter Summary

This chapter designed the Distributed Coordination System for the Distributed Task Scheduler Platform. We examined leader election, distributed leases, bucket ownership, heartbeats, failure detection, split-brain prevention, automatic failover, performance optimizations, and future migration from Redis to etcd. By coordinating ownership through temporary leases and automatic recovery, the platform enables Scanner, Cron, and other services to scale horizontally while ensuring that each unit of work is processed by only one active owner at a time.

---

# Next Chapter

**Chapter 23 — Scheduling Algorithms & Time Partitioning**

The next chapter explores the algorithms that power efficient scheduling at scale. It will cover time bucketing, scheduling wheels, priority queues, bucket selection strategies, polling algorithms, batching, fairness, complexity analysis, scalability to millions of scheduled jobs, and the evolution from PostgreSQL-based scheduling to distributed partitioned scheduling engines.

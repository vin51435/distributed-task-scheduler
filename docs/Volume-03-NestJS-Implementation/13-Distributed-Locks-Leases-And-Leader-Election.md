# Filename

**`V3-C13-Distributed-Locks-Leases-And-Leader-Election.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 13 — Implementing Distributed Locks, Leases & Leader Election in NestJS

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 13

**Filename:** `V3-C13-Distributed-Locks-Leases-And-Leader-Election.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Distributed Locks?
3. Lock vs Database Lock
4. Lock Architecture
5. Lock Manager
6. Lease Mechanism
7. Lock Lifecycle
8. Lease Renewal
9. Lock Expiration
10. Fencing Tokens
11. Leader Election
12. Failure Recovery
13. Scanner Integration
14. Dispatcher Integration
15. Worker Coordination
16. Performance Considerations
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 13.1 Introduction

By now our platform has:

- PostgreSQL
- gRPC
- RabbitMQ
- Redis

Redis provides one capability that is absolutely critical for distributed systems:

> **Distributed Coordination**

When multiple Scheduler or Scanner instances are running simultaneously, they must coordinate their work.

Without coordination, duplicate execution becomes inevitable.

This chapter implements that coordination using **distributed locks, leases, and leader election**.

---

# 13.2 The Problem

Imagine Kubernetes starts three Scheduler instances.

```text
Scheduler A

Scheduler B

Scheduler C
```

All three wake up at exactly the same moment.

All three query:

```text
Bucket #42
```

Every instance believes:

> "I should dispatch these jobs."

Result:

```text
Scheduler A

↓

Dispatch Job #100

Scheduler B

↓

Dispatch Job #100

Scheduler C

↓

Dispatch Job #100
```

Three identical jobs.

Three workers execute them.

Data corruption.

---

# 13.3 What is a Distributed Lock?

A distributed lock guarantees:

> Only one process owns a resource at a time.

Example:

```text
Bucket 42

↓

Redis Lock

↓

Owner

Scheduler B
```

Scheduler A:

```text
Acquire

↓

Failed
```

Scheduler C:

```text
Acquire

↓

Failed
```

Only Scheduler B proceeds.

---

# 13.4 Database Lock vs Redis Lock

Many developers confuse these.

Database Lock

```text
FOR UPDATE
```

Purpose:

- Protect rows
- Protect transactions

Lifetime:

```text
Transaction
```

---

Redis Lock

Purpose:

- Coordinate applications
- Coordinate machines
- Coordinate containers

Lifetime:

```text
Lease
```

These solve different problems.

---

# 13.5 Overall Architecture

```text
          Scheduler A

                │

          Scheduler B

                │

          Scheduler C

                │

       Distributed Lock Service

                │

          Redis Module

                │

             Redis Server
```

Nobody talks directly to Redis.

Applications talk to the Lock Service.

---

# 13.6 Project Structure

```text
packages/

redis/

locks/

├── lock.service.ts

├── lease.service.ts

├── leader.service.ts

├── fencing.service.ts

├── interfaces/

├── decorators/

├── exceptions/

├── metrics/

└── utils/
```

Each responsibility has its own component.

---

# 13.7 Lock Manager

Applications never execute Redis commands directly.

Instead:

```text
Scanner

↓

LockService

↓

Redis
```

Responsibilities:

- Acquire
- Release
- Renew
- Validate
- Generate fencing token
- Metrics
- Logging

---

# 13.8 Lock Acquisition

Workflow:

```text
Scheduler

↓

Acquire Lock

↓

Redis

↓

Success?
```

If success:

```text
Continue
```

Otherwise:

```text
Skip Bucket
```

The application never blocks waiting.

---

# 13.9 Lock Key Design

Locks require predictable names.

Example:

```text
scheduler:bucket:42
```

Another:

```text
worker:job:123
```

Another:

```text
scanner:leader
```

Key naming must remain consistent across every service.

---

# 13.10 Lease Mechanism

Locks are not permanent.

Instead:

```text
Acquire

↓

Lease

↓

30 Seconds
```

After TTL:

```text
Redis

↓

Automatically Deletes Lock
```

Nobody manually cleans abandoned locks.

---

# 13.11 Why Leases?

Suppose Scheduler crashes.

```text
Acquire Lock

↓

Crash
```

Without TTL:

```text
Lock

↓

Forever
```

No other Scheduler can continue.

Instead:

```text
30 Seconds

↓

Expired

↓

Next Scheduler Continues
```

This enables automatic recovery.

---

# 13.12 Lease Renewal

Long-running work extends its lease.

```text
Acquire

↓

TTL

↓

Renew

↓

TTL

↓

Renew
```

Renewal should happen before expiration.

Typical interval:

```text
Lease

30 seconds

↓

Renew every

10 seconds
```

---

# 13.13 Renewal Failure

Suppose Redis becomes unavailable.

```text
Lease Renewal

↓

Failed
```

Eventually:

```text
Lease

↓

Expires
```

Another Scheduler acquires the lock.

The first Scheduler must immediately stop processing.

Continuing would violate exclusivity.

---

# 13.14 Fencing Tokens

TTL alone is not sufficient.

Consider:

```text
Scheduler A

↓

Acquire Lock

↓

Pause (GC)

↓

TTL Expires
```

Meanwhile:

```text
Scheduler B

↓

Acquire Lock

↓

Continue
```

Later:

```text
Scheduler A

↓

Resumes
```

Now two owners exist.

Solution:

```text
Fencing Token
```

---

# 13.15 What is a Fencing Token?

Every successful acquisition receives a monotonically increasing number.

Example:

```text
Bucket 42

↓

Token

101
```

Next owner:

```text
Token

102
```

Later:

```text
Token

103
```

Only the newest token is accepted.

Old owners become invalid automatically.

---

# 13.16 Lock Validation

Before every critical operation:

```text
Current Token

↓

Still Valid?

↓

YES

↓

Continue
```

Otherwise:

```text
Stop Processing
```

This prevents stale workers from corrupting state.

---

# 13.17 Leader Election

Some services should have exactly one active instance.

Example:

```text
Scanner
```

Deployment:

```text
5 Pods
```

Only one scans buckets.

---

Workflow:

```text
Acquire

scanner:leader

↓

Winner

↓

Leader
```

Everyone else becomes standby.

---

# 13.18 Leader Failure

Leader:

```text
Scanner A
```

Crashes.

Lease expires.

Redis removes lock.

Remaining Scanners:

```text
Scanner B

↓

Acquire

↓

Leader
```

Leadership automatically transfers.

No manual intervention.

---

# 13.19 Scanner Workflow

Complete Scanner flow:

```text
Wake Up

↓

Leader?

↓

YES

↓

Acquire Bucket Lock

↓

Expand Jobs

↓

Dispatch

↓

Release Lock
```

Followers remain idle.

---

# 13.20 Dispatcher Workflow

Dispatcher receives:

```text
Bucket
```

Before dispatching:

```text
Acquire

dispatch:bucket:42
```

Success:

```text
Publish Jobs
```

Failure:

```text
Ignore
```

Duplicate dispatch never occurs.

---

# 13.21 Worker Coordination

Normally RabbitMQ prevents duplicate delivery.

However:

```text
Worker Crash

↓

Message Redelivery
```

Worker still checks:

```text
Redis

↓

Idempotency Key
```

Duplicate?

```text
ACK

↓

Done
```

Redis and RabbitMQ complement each other.

---

# 13.22 Lock Release

Proper workflow:

```text
Acquire

↓

Work

↓

Release
```

Improper workflow:

```text
Acquire

↓

Forget Release
```

TTL eventually cleans abandoned locks.

Applications should still release explicitly whenever possible.

---

# 13.23 Failure Recovery

Crash:

```text
Scheduler

↓

Dies
```

Recovery:

```text
Lease

↓

Expires

↓

Another Scheduler

↓

Acquire

↓

Continue
```

No operator intervention required.

---

# 13.24 Performance Considerations

Distributed locks should:

- Protect only critical sections.
- Be held briefly.
- Avoid network calls while locked.
- Avoid database scans while locked.
- Avoid long computations while locked.

Ideal:

```text
Acquire

↓

Read

↓

Update

↓

Release
```

Milliseconds.

Not minutes.

---

# 13.25 Complete Architecture

```text
              Scheduler Pods

      ┌──────────┼──────────┐

      ▼          ▼          ▼

   Scheduler A  Scheduler B  Scheduler C

             │

             ▼

        Lock Service

             │

      ┌──────┼──────────┐

      ▼      ▼          ▼

 Acquire  Renew   Release

             │

             ▼

          Redis
```

Every distributed coordination request flows through the Lock Service.

---

# 13.26 Metrics

Useful metrics:

```text
Locks Acquired

Locks Failed

Lease Renewals

Renew Failures

Leader Changes

Average Hold Time

Contention Rate

Expired Locks
```

These metrics help identify contention hotspots.

---

# 13.27 Future Evolution

Current:

```text
Redis Locks
```

↓

Future:

```text
Redis Cluster
```

↓

```text
Redlock Algorithm
```

↓

```text
Multi-Region Coordination
```

↓

```text
ZooKeeper
```

↓

```text
etcd
```

↓

```text
Consul
```

The application code remains unchanged because coordination is abstracted behind the `LockService`.

---

# 13.28 Best Practices

- Never access Redis locks directly from business logic.
- Acquire locks only around critical sections.
- Use short lease durations.
- Renew leases proactively.
- Always release locks explicitly.
- Use fencing tokens to prevent stale owners.
- Use leader election for singleton services.
- Keep lock contention low.
- Monitor lock metrics continuously.
- Design all lock operations to fail safely.

---

# Chapter Summary

This chapter implemented distributed coordination for the scheduler platform. We built a centralized `LockService`, introduced leases with automatic expiration, implemented lease renewal, fencing tokens, leader election, and failure recovery, and integrated these mechanisms into the Scanner, Dispatcher, and Worker services. These coordination primitives ensure that multiple instances can safely cooperate in a distributed environment without duplicate execution or stale ownership.

---

# Next Chapter

**Filename:** `V3-C14-Caching-Strategies-And-Cache-Invalidation.md`

**Chapter 14 — Advanced Caching Strategies & Cache Invalidation**

The next chapter will focus entirely on caching. We will cover cache-aside, read-through, write-through, write-behind, cache invalidation, TTL design, distributed cache synchronization, event-driven invalidation using Redis Pub/Sub, hot-key mitigation, cache stampede prevention, negative caching, cache warming, and how these strategies are applied throughout the scheduler platform.

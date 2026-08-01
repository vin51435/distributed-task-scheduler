# Chapter 3 — Distributed Systems Fundamentals

**Document:** Distributed Task Scheduler Platform
**Chapter:** 3
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. What is a Distributed System?
3. Why Build a Distributed Scheduler?
4. Monolith vs Distributed System
5. Scalability
6. CAP Theorem
7. Consistency Models
8. Replication
9. Partitioning & Sharding
10. Consensus
11. Leader Election
12. Distributed Coordination
13. Leases & Heartbeats
14. Failure Detection
15. Idempotency
16. Fault Tolerance
17. Eventual Consistency
18. Horizontal Scaling
19. Distributed Messaging
20. Applying These Concepts to Our Scheduler
21. Chapter Summary

---

# 3.1 Introduction

Before designing any distributed system, it is essential to understand the fundamental concepts that influence its architecture.

A scheduler may appear to be a simple application that stores jobs and executes them later. However, once the system must support millions of jobs, multiple machines, failover, retries, and zero data loss, it becomes a distributed systems problem.

This chapter introduces the theoretical foundation that will guide every architectural decision made throughout this project.

---

# 3.2 What is a Distributed System?

A **distributed system** is a collection of independent computers that cooperate to appear as a single system to users.

From the user's perspective:

```text
Create Job

↓

Job Executes Tomorrow
```

It appears that one application handled everything.

Internally, however, the request may travel through several independent services:

```text
Client

↓

API Service

↓

Timer Service

↓

PostgreSQL

↓

Scanner Service

↓

RabbitMQ

↓

Worker Service

↓

Notification Service
```

Each service runs independently, communicates over the network, and can fail independently.

---

# 3.3 Why Build a Distributed Scheduler?

Imagine a scheduler running on one machine.

```text
Server

├── API
├── Database
├── Timer
└── Worker
```

This works for small applications.

Problems arise when:

- 100 million scheduled jobs exist.
- Thousands of jobs become due every second.
- The server crashes.
- Traffic spikes during business hours.
- Maintenance requires restarting services.

A distributed architecture allows the workload to be shared across many machines.

---

# 3.4 Monolith vs Distributed System

## Monolithic Architecture

```text
┌─────────────────────┐
│      Application    │
│                     │
│ API                 │
│ Scheduler           │
│ Worker              │
│ Database Access     │
└─────────────────────┘
```

### Advantages

- Easy to develop
- Easy to debug
- Simple deployment
- Low latency

### Disadvantages

- Limited scalability
- Entire application restarts together
- Difficult to scale individual components

---

## Distributed Architecture

```text
            Client
               │
        REST API Service
               │
        gRPC Communication
               │
        Timer Service
               │
        PostgreSQL
               │
      Scanner Services
               │
          RabbitMQ
               │
      Worker Services
               │
     Business Services
```

### Advantages

- Independent scaling
- Fault isolation
- Better resource utilization
- High availability

### Disadvantages

- More complex
- Network latency
- Distributed failures
- Operational overhead

---

# 3.5 Scalability

Scalability is the ability of a system to handle increasing workloads.

There are two primary approaches.

## Vertical Scaling

Increase the resources of a single machine.

Example:

```text
CPU

4 cores

↓

16 cores

Memory

8 GB

↓

64 GB
```

Advantages:

- Simple
- No architectural changes

Limitations:

- Hardware limits
- Expensive
- Single point of failure

---

## Horizontal Scaling

Add more machines.

```text
           Load Balancer
          /      |      \
      API-1   API-2   API-3
```

Advantages:

- Virtually unlimited growth
- High availability
- Better fault tolerance

Our scheduler is designed for horizontal scaling.

---

# 3.6 CAP Theorem

The CAP Theorem states that a distributed system cannot simultaneously guarantee all three properties:

- Consistency (C)
- Availability (A)
- Partition Tolerance (P)

When a network partition occurs, the system must choose between consistency and availability.

## Consistency

Every node returns the same data.

Example:

```
Job Status = SUCCESS
```

All nodes immediately agree.

---

## Availability

Every request receives a response, even if some nodes are unavailable.

---

## Partition Tolerance

The system continues operating despite communication failures between nodes.

Network partitions are inevitable in distributed systems, so partition tolerance is generally non-negotiable.

---

## CAP in Our Scheduler

Our scheduler prioritizes:

- Partition Tolerance
- Availability

while accepting **eventual consistency** in some operations, such as metrics or audit updates.

Critical operations, such as job storage, rely on PostgreSQL transactions for strong consistency.

---

# 3.7 Consistency Models

Different operations require different levels of consistency.

## Strong Consistency

Every read returns the latest committed value.

Used for:

- Job creation
- Job cancellation
- Retry scheduling

---

## Eventual Consistency

Updates propagate over time.

Used for:

- Metrics
- Dashboards
- Logs
- Monitoring

---

## Why Not Strong Consistency Everywhere?

Strong consistency often reduces availability and throughput.

Distributed systems typically apply the strongest consistency only where necessary.

---

# 3.8 Replication

Replication stores copies of data across multiple nodes.

Example:

```text
Primary PostgreSQL
      │
 ┌────┴────┐
 │         │
Replica 1 Replica 2
```

Advantages:

- High availability
- Read scaling
- Disaster recovery

Future versions of the scheduler can leverage PostgreSQL replication or Cassandra replication for resilience.

---

# 3.9 Partitioning & Sharding

A single database table containing hundreds of millions of jobs becomes inefficient.

The solution is to divide data.

## Partitioning

Split data within one database.

Example:

```text
jobs_2027_01
jobs_2027_02
jobs_2027_03
```

---

## Sharding

Split data across multiple databases.

Example:

```text
Shard 1 → Tenant A–M
Shard 2 → Tenant N–Z
```

In our scheduler, waiting jobs will eventually be partitioned by **time buckets** and **shards**.

---

# 3.10 Consensus

Consensus is the process by which multiple nodes agree on a single value.

Examples:

- Which scanner owns Bucket 5?
- Which node is the leader?
- Which worker should recover abandoned work?

Consensus algorithms include:

- Raft
- Paxos

In the first version of this project, we avoid implementing consensus directly by using Redis for simple coordination. Later versions may use **etcd**, which implements Raft internally.

---

# 3.11 Leader Election

Some distributed tasks should be performed by only one node.

Example:

```text
Cron Expansion
```

If every node expands cron schedules simultaneously, duplicate jobs are created.

Leader election ensures that exactly one node performs this responsibility.

Example:

```text
Scanner A → Leader
Scanner B → Follower
Scanner C → Follower
```

The leader performs exclusive tasks until it fails, after which a new leader is elected.

---

# 3.12 Distributed Coordination

Multiple services need to coordinate without direct knowledge of one another.

Examples:

- Scanner ownership
- Bucket assignment
- Distributed locks
- Worker coordination

In Version 1:

```text
Redis
```

In future versions:

```text
etcd
```

---

# 3.13 Leases & Heartbeats

Instead of permanent ownership, services acquire temporary **leases**.

Example:

```text
Bucket 12

Owner: Scanner A

Lease: 30 seconds
```

Scanner A periodically renews its lease by sending **heartbeats**.

If heartbeats stop:

```text
Lease expires

↓

Scanner B acquires bucket
```

This prevents abandoned work.

---

# 3.14 Failure Detection

Distributed systems assume that failures will happen.

Possible failures include:

- Machine crash
- Power outage
- Network partition
- Container restart
- Process crash

Rather than preventing failures, systems detect and recover from them.

Heartbeats, health checks, and lease expiration form the basis of failure detection in our scheduler.

---

# 3.15 Idempotency

Distributed messaging often results in duplicate deliveries.

Example:

```text
Worker processes email

↓

Worker crashes before ACK

↓

RabbitMQ redelivers message
```

Without protection, the user receives two emails.

Idempotency ensures that processing the same request multiple times produces the same result.

This concept is critical and will receive a dedicated chapter later in this handbook.

---

# 3.16 Fault Tolerance

Fault tolerance is the ability of the system to continue functioning despite failures.

Examples:

- Worker crashes
- Scanner restarts
- RabbitMQ restarts
- Redis temporarily unavailable

Strategies include:

- retries
- redundancy
- replication
- checkpoints
- leases
- persistent storage

---

# 3.17 Eventual Consistency

Some components do not require immediate consistency.

For example:

```text
Worker finishes job

↓

Audit written

↓

Dashboard updated
```

The dashboard may lag by a few seconds without affecting correctness.

Choosing eventual consistency for non-critical components improves scalability.

---

# 3.18 Horizontal Scaling in Our Scheduler

Each service should scale independently.

```text
REST API

3 instances

↓

Timer Service

2 instances

↓

Scanner

5 instances

↓

RabbitMQ

↓

Worker

20 instances
```

Because services are stateless where possible, adding more instances increases throughput.

---

# 3.19 Distributed Messaging

The scheduler separates **time management** from **execution** using asynchronous messaging.

Flow:

```text
Client

↓

Timer Service

↓

PostgreSQL

↓

Scanner

↓

RabbitMQ

↓

Worker

↓

Business Service
```

This architecture provides:

- loose coupling
- retry capability
- buffering
- independent scaling

RabbitMQ acts as the bridge between scheduling and execution.

---

# 3.20 Applying These Concepts to Our Scheduler

The concepts introduced in this chapter directly influence the scheduler's design:

| Distributed Systems Concept | Scheduler Application                             |
| --------------------------- | ------------------------------------------------- |
| Horizontal Scaling          | Multiple API, Scanner, and Worker instances       |
| Partitioning                | Time buckets and shards                           |
| Replication                 | PostgreSQL replicas and future Cassandra clusters |
| Leader Election             | Cron expansion and coordination                   |
| Leases                      | Scanner ownership of buckets                      |
| Heartbeats                  | Detect failed scanners and workers                |
| Idempotency                 | Safe retries and duplicate message handling       |
| Fault Tolerance             | Automatic recovery after failures                 |
| Eventual Consistency        | Metrics, audit logs, dashboards                   |
| Distributed Messaging       | RabbitMQ decouples scheduling from execution      |

Every architectural decision in later chapters will reference one or more of these principles.

---

# 3.21 Key Takeaways

- A distributed system is a collection of independent services working together as one platform.
- Horizontal scaling is preferred over vertical scaling for large workloads.
- Network failures are expected, not exceptional.
- CAP theorem requires trade-offs; our scheduler favors availability and partition tolerance where appropriate.
- Strong consistency is reserved for critical operations like job creation and scheduling.
- Partitioning and sharding enable the system to handle massive datasets.
- Leases and heartbeats allow safe ownership of distributed work.
- Idempotency is essential because duplicate message delivery is unavoidable.
- RabbitMQ enables asynchronous execution, while PostgreSQL provides durable timer storage.
- Reliability comes from designing for failure, not assuming failure will never happen.

---

# Chapter Summary

This chapter introduced the distributed systems concepts that underpin the entire scheduler architecture. We explored scalability, CAP theorem, consistency models, replication, partitioning, consensus, leader election, distributed coordination, leases, heartbeats, fault tolerance, and asynchronous messaging. These principles explain **why** the scheduler will be built as a collection of cooperating services rather than a single application and provide the theoretical foundation for every architectural decision that follows.

---

## Next Chapter

**Chapter 4 — High-Level Architecture**

We will transition from theory to design by defining the complete system architecture, identifying every microservice, mapping service boundaries, explaining the request lifecycle, and showing how the Timing Plane and Execution Plane interact to reliably schedule and execute millions of jobs.

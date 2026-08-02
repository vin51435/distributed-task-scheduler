# Chapter 23 — Scheduling Algorithms & Time Partitioning

**Document:** Distributed Task Scheduler Platform
**Chapter:** 23
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Scheduling Goals
3. Scheduling Architecture
4. Why Time Partitioning?
5. Time Bucketing
6. Bucket Selection Algorithm
7. Job Promotion Algorithm
8. Batch Scheduling
9. Fair Scheduling
10. Priority Scheduling
11. Scheduling Complexity
12. Scalability Strategy
13. Failure Recovery
14. Future Evolution
15. Best Practices
16. Chapter Summary

---

# 23.1 Introduction

Scheduling is the core responsibility of the Distributed Task Scheduler Platform.

Its purpose is to determine **which jobs are ready for execution and when they should be promoted into the execution pipeline**.

Unlike traditional cron daemons that repeatedly scan every scheduled job, this platform minimizes unnecessary work by organizing jobs into logical time partitions, allowing the Scanner Service to inspect only the portions of the dataset that may contain executable jobs.

This design enables the scheduler to efficiently support millions of scheduled jobs.

---

# 23.2 Scheduling Goals

The scheduling engine is designed to provide:

- Accurate execution timing
- Predictable latency
- High throughput
- Horizontal scalability
- Efficient database utilization
- Fair workload distribution
- Minimal scanning overhead
- Fault tolerance

The scheduler prioritizes deterministic behavior over maximum throughput.

---

# 23.3 Scheduling Architecture

```text
                 PostgreSQL

                      │

              Timer Store

                      │

              Time Buckets

                      │

             Scanner Service

                      │

           Due Job Selection

                      │

            Dispatcher Service

                      │

                RabbitMQ
```

Scheduling is divided into two distinct stages:

1. Determine which jobs are due.
2. Promote them into the execution pipeline.

---

# 23.4 Why Time Partitioning?

Suppose the database contains:

```text
100 Million Jobs
```

A naïve scheduler would repeatedly execute:

```sql
SELECT *
FROM jobs
WHERE execute_at <= NOW();
```

Every scheduler instance would scan the same enormous dataset.

Instead, jobs are partitioned by execution time.

Example:

```text
09:00 Bucket

09:01 Bucket

09:02 Bucket

09:03 Bucket
```

The Scanner examines only the buckets whose execution time has arrived.

This dramatically reduces query cost.

---

# 23.5 Time Bucketing

Every scheduled job belongs to a logical bucket.

Example:

```text
Job A

↓

09:00 Bucket
```

```text
Job B

↓

09:05 Bucket
```

```text
Job C

↓

10:30 Bucket
```

Jobs with similar execution times are grouped together.

The bucket identifier may be derived from:

```text
Bucket = floor(execute_at / bucket_size)
```

Example bucket sizes:

| Bucket Size | Typical Use Case          |
| ----------- | ------------------------- |
| 1 Minute    | High precision scheduling |
| 5 Minutes   | Large deployments         |
| 15 Minutes  | Long-running workloads    |
| 1 Hour      | Low-frequency scheduling  |

The bucket size can evolve without changing the overall scheduling architecture.

---

# 23.6 Bucket Selection Algorithm

The Scanner continuously determines which buckets should be processed.

Example:

```text
Current Time

↓

09:15
```

Buckets:

```text
09:10

09:11

09:12

09:13

09:14

09:15
```

Future buckets remain untouched.

Example:

```text
09:16

09:17

09:18
```

Only eligible buckets are scanned.

---

## Ownership

Each bucket belongs to exactly one Scanner instance.

```text
Bucket 1–100

↓

Scanner A
```

```text
Bucket 101–200

↓

Scanner B
```

```text
Bucket 201–300

↓

Scanner C
```

Ownership is coordinated using distributed leases.

---

# 23.7 Job Promotion Algorithm

Within a bucket, jobs are processed in batches.

Algorithm:

```text
Select Batch

↓

Acquire Lease

↓

Validate State

↓

Promote

↓

Publish

↓

Commit

↓

Repeat
```

Promotion changes the job state:

```text
READY

↓

DISPATCHED
```

The Scanner never modifies jobs already owned by another process.

---

# 23.8 Batch Scheduling

Processing one job at a time is inefficient.

Instead:

```text
500 Jobs

↓

Single Query

↓

Batch Promotion
```

Benefits:

- Fewer database queries
- Better CPU utilization
- Reduced network overhead
- Higher throughput

Batch size is configurable based on workload characteristics.

---

# 23.9 Fair Scheduling

The scheduler must prevent busy buckets from starving others.

Without fairness:

```text
Bucket A

100,000 Jobs

↓

Scanner Busy
```

Meanwhile:

```text
Bucket B

50 Jobs

↓

Waits
```

Instead:

```text
Round-Robin

↓

Bucket A

↓

Bucket B

↓

Bucket C

↓

Repeat
```

This ensures that every bucket continues to make progress.

---

# 23.10 Priority Scheduling

Some workloads require higher execution priority.

Example priorities:

| Priority | Typical Workload   |
| -------- | ------------------ |
| High     | Payment processing |
| Medium   | Notifications      |
| Low      | Reports            |

Within a bucket:

```text
High

↓

Medium

↓

Low
```

Priority influences dispatch order but never bypasses execution time.

A future high-priority job cannot execute before its scheduled time.

---

# 23.11 Scheduling Complexity

Naïve scheduling:

```text
Every Scan

↓

All Jobs
```

Complexity:

```text
O(N)
```

Bucket scheduling:

```text
Relevant Buckets

↓

Relevant Jobs
```

Complexity:

```text
O(B + J)
```

Where:

- **B** = Active buckets
- **J** = Jobs within scanned buckets

As the dataset grows, scheduling cost depends primarily on active work rather than total stored jobs.

---

# 23.12 Scalability Strategy

### Phase 1

```text
Single Scanner
```

↓

### Phase 2

```text
Time Buckets
```

↓

### Phase 3

```text
Multiple Scanners

Bucket Ownership
```

↓

### Phase 4

```text
Dynamic

Bucket Rebalancing
```

↓

### Phase 5

```text
Distributed

Partitioned Scheduling
```

The scheduling algorithm scales horizontally by distributing ownership rather than duplicating work.

---

# 23.13 Failure Recovery

## Scanner Failure

```text
Scanner

↓

Crash

↓

Lease Expires

↓

Bucket Reassigned
```

---

## Missed Bucket

```text
Scanner Offline

↓

Restart

↓

Rescan

↓

Promote Missed Jobs
```

---

## Partial Batch

```text
500 Jobs

↓

250 Promoted

↓

Crash

↓

Recovery

↓

Resume
```

State transitions ensure that already promoted jobs are not promoted again.

---

## Database Failure

```text
Query Failed

↓

Rollback

↓

Retry Later
```

The Timer Store remains the authoritative source of scheduling state.

---

# 23.14 Future Evolution

### Phase 1

```text
Minute Buckets
```

↓

### Phase 2

```text
Dynamic Bucket Sizes
```

↓

### Phase 3

```text
Adaptive Scheduling
```

↓

### Phase 4

```text
Distributed

Consistent Hashing
```

↓

### Phase 5

```text
Partitioned

Cassandra Timer Store
```

As the platform evolves, the scheduling algorithm becomes increasingly distributed while preserving the same logical scheduling model.

---

# 23.15 Scheduling Best Practices

The scheduling engine follows these principles:

- Partition jobs by execution time.
- Scan only eligible buckets.
- Keep bucket ownership exclusive.
- Process jobs in batches.
- Maintain fair scheduling across buckets.
- Respect execution timestamps before priority.
- Avoid full-table scans.
- Keep scheduling stateless.
- Recover automatically after failures.
- Monitor scheduling latency and bucket health.

---

# 23.16 Scheduling Metrics

| Metric                   | Purpose                   |
| ------------------------ | ------------------------- |
| Active Buckets           | Scheduling workload       |
| Bucket Scan Time         | Scanner performance       |
| Jobs Promoted            | Throughput                |
| Promotion Latency        | Scheduling accuracy       |
| Bucket Ownership Changes | Cluster balancing         |
| Scheduling Lag           | Delay from scheduled time |
| Batch Size               | Promotion efficiency      |
| Scanner Utilization      | Resource usage            |

These metrics provide visibility into the efficiency and correctness of the scheduling engine.

---

# Chapter Summary

This chapter designed the scheduling algorithms used by the Distributed Task Scheduler Platform. We explored time partitioning, logical bucketing, bucket selection, batch promotion, fair scheduling, priority handling, scheduling complexity, scalability strategies, failure recovery, and future evolution toward distributed partitioned scheduling. By organizing jobs into time-based buckets and assigning exclusive ownership to Scanner instances, the platform minimizes database overhead while maintaining accurate, scalable, and fault-tolerant scheduling for millions of timed jobs.

---

# Next Chapter

**Chapter 24 — Fault Tolerance & High Availability**

The next chapter examines how the Distributed Task Scheduler Platform remains operational during failures. It will cover redundancy, replication, graceful degradation, service failover, database recovery, broker recovery, network partitions, disaster recovery strategies, backup and restore procedures, recovery objectives (RTO/RPO), and architectural patterns that eliminate single points of failure.

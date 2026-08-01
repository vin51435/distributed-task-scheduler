# Filename

**`V2-C16-Monitoring-Metrics-And-System-Health.md`**

---

# Volume 2 — Database Design

# Chapter 16 — Monitoring, Metrics & System Health Storage

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 16

**Filename:** `V2-C16-Monitoring-Metrics-And-System-Health.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Monitoring Needs Its Own Database
3. Observability Architecture
4. Monitoring Domains
5. Worker Heartbeats
6. Service Health
7. Metrics Storage
8. Queue Metrics
9. Scheduler Metrics
10. Alert Rules
11. Historical Aggregation
12. Query Patterns
13. Constraints & Indexes
14. Complete SQL
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 16.1 Introduction

A distributed scheduler consists of many independently running services.

Examples:

- API Gateway
- Scheduler Service
- Scanner Service
- Dispatcher Service
- Worker Service
- Notification Service
- Redis
- RabbitMQ
- PostgreSQL

Simply knowing that these services are "running" is not enough.

Production systems need answers to questions like:

- Is the Scanner behind schedule?
- Which Worker is overloaded?
- Is RabbitMQ becoming a bottleneck?
- How many jobs are waiting?
- Which tenant consumes the most resources?
- Are dispatchers healthy?
- Is scheduler latency increasing?

These questions require a dedicated monitoring subsystem.

---

# 16.2 Why Monitoring Needs Its Own Database

A common beginner mistake:

```text
Health Endpoint

↓

200 OK
```

This only tells us the service is alive.

It does **not** tell us:

- Performance
- Capacity
- Throughput
- Historical trends
- Failure rates

Instead:

```text
Service

↓

Metrics

↓

Database

↓

Dashboard

↓

Alerts
```

Historical metrics become available for analysis.

---

# 16.3 Observability Architecture

```text
Services

↓

Prometheus Metrics

↓

Metrics Collector

↓

PostgreSQL

↓

Grafana

↓

Alerts
```

Real-time metrics are scraped by Prometheus.

Important historical snapshots are stored in PostgreSQL.

This provides:

- Real-time monitoring
- Historical reporting
- Capacity planning

---

# 16.4 Monitoring Domains

The scheduler monitors multiple domains.

```text
Infrastructure

↓

Application

↓

Business

↓

Scheduler

↓

Workers

↓

RabbitMQ

↓

Database
```

Each domain produces different metrics.

---

# 16.5 Worker Heartbeats

Every Worker periodically reports:

```text
Worker

↓

Heartbeat

↓

Database
```

Table:

```text
monitoring.worker_heartbeats
```

Purpose:

Detect failed workers.

---

## Columns

| Column         | Type          |
| -------------- | ------------- |
| id             | UUID          |
| worker_id      | UUID          |
| worker_name    | VARCHAR       |
| node_name      | VARCHAR       |
| status         | worker_status |
| active_jobs    | INTEGER       |
| cpu_percent    | NUMERIC       |
| memory_mb      | INTEGER       |
| last_heartbeat | TIMESTAMPTZ   |

---

## Heartbeat Example

```text
Worker #4

↓

Running

↓

3 Active Jobs

↓

CPU 28%

↓

Memory 120MB
```

Heartbeats every:

```text
5 Seconds
```

---

# 16.6 Service Health

Services also publish health information.

Table:

```text
monitoring.service_health
```

---

## Columns

| Column         | Type          |
| -------------- | ------------- |
| id             | UUID          |
| service_name   | VARCHAR       |
| instance_id    | UUID          |
| status         | health_status |
| uptime_seconds | BIGINT        |
| version        | VARCHAR       |
| checked_at     | TIMESTAMPTZ   |

---

Status values:

```text
UP

DOWN

DEGRADED

STARTING

STOPPING
```

---

# 16.7 Metrics Storage

Metrics are stored as time-series snapshots.

Table:

```text
monitoring.metrics
```

---

## Columns

| Column       | Type             |
| ------------ | ---------------- |
| id           | UUID             |
| metric_name  | VARCHAR          |
| metric_type  | metric_type      |
| service_name | VARCHAR          |
| value        | DOUBLE PRECISION |
| labels       | JSONB            |
| recorded_at  | TIMESTAMPTZ      |

---

Example:

```text
scheduler.jobs.waiting
```

↓

```text
14582
```

Labels:

```json
{
  "tenant": "acme",
  "region": "ap-south-1"
}
```

---

# 16.8 Queue Metrics

RabbitMQ metrics are periodically captured.

Table:

```text
monitoring.queue_metrics
```

---

## Columns

| Column           | Type        |
| ---------------- | ----------- |
| id               | UUID        |
| queue_name       | VARCHAR     |
| ready_messages   | INTEGER     |
| unacked_messages | INTEGER     |
| consumers        | INTEGER     |
| publish_rate     | NUMERIC     |
| consume_rate     | NUMERIC     |
| snapshot_time    | TIMESTAMPTZ |

---

Example:

```text
scheduler.jobs

↓

Ready

145

↓

Consumers

25
```

These snapshots allow trend analysis.

---

# 16.9 Scheduler Metrics

The scheduler itself publishes specialized metrics.

Table:

```text
monitoring.scheduler_metrics
```

---

## Metrics

| Metric                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| scheduler_lag_ms       | Delay between scheduled and actual execution |
| scanner_duration_ms    | Scanner runtime                              |
| dispatcher_duration_ms | Dispatch runtime                             |
| bucket_scan_count      | Buckets scanned                              |
| jobs_promoted          | Jobs dispatched                              |
| retry_rate             | Retry percentage                             |
| dlq_rate               | DLQ percentage                               |

---

## Columns

| Column        | Type             |
| ------------- | ---------------- |
| id            | UUID             |
| metric_name   | VARCHAR          |
| value         | DOUBLE PRECISION |
| scanner_id    | UUID             |
| dispatcher_id | UUID             |
| recorded_at   | TIMESTAMPTZ      |

---

# 16.10 Alert Rules

Alerts are configurable.

Table:

```text
monitoring.alert_rules
```

---

## Examples

```text
Queue > 10000
```

↓

Warning

---

```text
Worker Offline > 30 sec
```

↓

Critical

---

```text
Scheduler Lag > 5 sec
```

↓

Warning

---

## Columns

| Column      | Type                |
| ----------- | ------------------- |
| id          | UUID                |
| name        | VARCHAR             |
| metric_name | VARCHAR             |
| operator    | comparison_operator |
| threshold   | DOUBLE PRECISION    |
| severity    | alert_severity      |
| enabled     | BOOLEAN             |

---

# 16.11 Historical Aggregation

Raw metrics grow rapidly.

Example:

```text
1 Metric

↓

Every Second

↓

31 Million Rows / Year
```

Instead:

Raw metrics:

```text
1 Minute
```

↓

Aggregated:

```text
Hourly
```

↓

Daily

↓

Monthly

````

Aggregation reduces storage while preserving trends.

---

# 16.12 Relationship Diagram

```text
Workers

      │

      ▼

worker_heartbeats

      │

      ▼

metrics

      │

      ▼

alerts

      │

      ▼

Dashboards
````

Every service contributes metrics.

---

# 16.13 Query Patterns

Worker health:

```sql
SELECT *
FROM monitoring.worker_heartbeats
WHERE last_heartbeat > NOW() - INTERVAL '10 seconds';
```

Queue snapshots:

```sql
SELECT *
FROM monitoring.queue_metrics
ORDER BY snapshot_time DESC;
```

Scheduler lag:

```sql
SELECT *
FROM monitoring.scheduler_metrics
WHERE metric_name='scheduler_lag_ms';
```

CPU usage:

```sql
SELECT *
FROM monitoring.worker_heartbeats
WHERE cpu_percent > 80;
```

Alert rules:

```sql
SELECT *
FROM monitoring.alert_rules
WHERE enabled=TRUE;
```

---

# 16.14 Constraints

Worker Heartbeats

```sql
PRIMARY KEY(id)
```

Service Health

```sql
PRIMARY KEY(id)
```

Metrics

```sql
CHECK(value>=0)
```

Queue Metrics

```sql
CHECK(ready_messages>=0)
```

Alert Rules

```sql
CHECK(threshold>=0)
```

---

# 16.15 Index Strategy

Heartbeats:

```text
(worker_id)
```

```text
(last_heartbeat)
```

Metrics:

```text
(metric_name)
```

```text
(recorded_at)
```

Queue Metrics:

```text
(queue_name)
```

Scheduler Metrics:

```text
(metric_name)
```

Composite:

```text
(metric_name, recorded_at)
```

Composite:

```text
(queue_name, snapshot_time)
```

---

# 16.16 Initial SQL Definition

## worker_heartbeats

```sql
CREATE TABLE monitoring.worker_heartbeats (

    id UUID PRIMARY KEY,

    worker_id UUID,

    worker_name VARCHAR(255),

    node_name VARCHAR(255),

    status worker_status,

    active_jobs INTEGER,

    cpu_percent NUMERIC(5,2),

    memory_mb INTEGER,

    last_heartbeat TIMESTAMPTZ
);
```

---

## metrics

```sql
CREATE TABLE monitoring.metrics (

    id UUID PRIMARY KEY,

    metric_name VARCHAR(255),

    metric_type metric_type,

    service_name VARCHAR(255),

    value DOUBLE PRECISION,

    labels JSONB,

    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## queue_metrics

```sql
CREATE TABLE monitoring.queue_metrics (

    id UUID PRIMARY KEY,

    queue_name VARCHAR(255),

    ready_messages INTEGER,

    unacked_messages INTEGER,

    consumers INTEGER,

    publish_rate NUMERIC(10,2),

    consume_rate NUMERIC(10,2),

    snapshot_time TIMESTAMPTZ DEFAULT NOW()
);
```

---

## scheduler_metrics

```sql
CREATE TABLE monitoring.scheduler_metrics (

    id UUID PRIMARY KEY,

    metric_name VARCHAR(255),

    value DOUBLE PRECISION,

    scanner_id UUID,

    dispatcher_id UUID,

    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## alert_rules

```sql
CREATE TABLE monitoring.alert_rules (

    id UUID PRIMARY KEY,

    name VARCHAR(255),

    metric_name VARCHAR(255),

    operator comparison_operator,

    threshold DOUBLE PRECISION,

    severity alert_severity,

    enabled BOOLEAN
);
```

---

# 16.17 Prometheus Integration

Prometheus remains the primary monitoring system.

Workflow:

```text
Workers

↓

/metrics Endpoint

↓

Prometheus

↓

Grafana
```

The PostgreSQL monitoring schema stores:

- snapshots
- business metrics
- long-term history
- alert configuration

Prometheus stores high-frequency operational metrics.

This hybrid model combines the strengths of both systems.

---

# 16.18 Operational Dashboard

Typical dashboard:

| Metric                | Purpose                |
| --------------------- | ---------------------- |
| Active Workers        | Worker availability    |
| Scanner Lag           | Scheduling accuracy    |
| Dispatcher Throughput | Message publishing     |
| Queue Depth           | RabbitMQ health        |
| Average Job Duration  | Performance            |
| DLQ Growth            | Reliability            |
| Retry Rate            | Stability              |
| CPU & Memory          | Capacity planning      |
| Jobs Executed/sec     | Throughput             |
| Tenant Usage          | Multi-tenant analytics |

---

# 16.19 Future Evolution

```text
Basic Health Checks

↓

Metrics Storage

↓

Prometheus

↓

Grafana

↓

OpenTelemetry

↓

Distributed Tracing

↓

AI Anomaly Detection

↓

Predictive Autoscaling
```

Future versions can integrate OpenTelemetry metrics, traces, and logs into a unified observability platform.

---

# 16.20 Best Practices

- Separate operational metrics from business data.
- Store heartbeats frequently.
- Aggregate historical metrics.
- Use Prometheus for high-frequency collection.
- Use PostgreSQL for long-term reporting.
- Monitor scheduler lag continuously.
- Capture queue depth snapshots.
- Alert on trends, not just thresholds.
- Keep dashboards tenant-aware.
- Archive old metric data.

---

# Chapter Summary

This chapter designed the monitoring and observability storage model for the distributed scheduler platform. We created tables for worker heartbeats, service health, metrics, queue snapshots, scheduler metrics, and alert rules. We explored Prometheus integration, historical aggregation, operational dashboards, indexing strategies, and SQL definitions. Together, these components provide comprehensive visibility into system health, scheduler performance, infrastructure capacity, and long-term operational trends.

---

# Next Chapter

**Filename:** `V2-C17-Database-Partitioning-And-Archival.md`

**Chapter 17 — Database Partitioning, Retention & Archival Strategy**

The next chapter will design one of the most important scalability features of the database: table partitioning, data retention policies, archival workflows, cold storage, historical reporting, partition pruning, and strategies for handling billions of records while maintaining high query performance.

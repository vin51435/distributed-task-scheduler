# Distributed Task Scheduler & Execution Platform

A general-purpose, fault-tolerant, highly available, and scalable distributed task scheduling and execution system.

## 3-Plane System Architecture

The platform separates responsibilities into three distinct planes:

```text
                         ┌────────────────────────────┐
                         │        API Gateway         │
                         └─────────────┬──────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
        Scheduler Service      Identity Service      Notification API
                │
                ▼
        PostgreSQL (Schedules)
                │
═══════════════════════════════════════════════════════════════════════
                     TIMING PLANE
═══════════════════════════════════════════════════════════════════════
                │
                ▼
          Scanner Service  ──(Finds due schedules)──► PostgreSQL (Jobs: status = READY)
                │
═══════════════════════════════════════════════════════════════════════
                    DISPATCH PLANE
═══════════════════════════════════════════════════════════════════════
                │
                ▼
        Dispatcher Service ──(Batch reads READY jobs, attaches routing key)
                │
                ▼
        RabbitMQ Exchange (Topic Routing)
                │
═══════════════════════════════════════════════════════════════════════
                    EXECUTION PLANE
═══════════════════════════════════════════════════════════════════════
                │
        ┌───────┼────────┬─────────┬─────────┐
        ▼       ▼        ▼         ▼         ▼
    email.q  webhook.q image.q   ai.q     custom.q
        │       │        │         │         │
        ▼       ▼        ▼         ▼         ▼
   Email Worker Webhook Worker Image Worker AI Worker
        │       │        │         │         │
        └───────┴────────┴─────────┴─────────┘
                         │
                         ▼
        PostgreSQL (Executions History: Job -> Execution #1, #2...)
```

### Architectural Planes & Responsibilities

1. **Timing Plane** (_When should work happen?_):
   - **Scheduler Service**: Manages user schedule definitions (`POST /schedules`, CRON expressions, one-off time specifications).
   - **Scanner Service**: Periodically scans `schedules` where `next_execute_at <= NOW()`, creates job records with `status = READY`, and updates recurring schedule execution times.
   - **Data Model**: `Schedules` $\rightarrow$ `Jobs` (`status = READY`).

2. **Dispatch Plane** (_How does work reach the correct execution channel?_):
   - **Dispatcher Service**: Reads `READY` jobs in batches, validates payloads, attaches routing keys (`worker.email`, `worker.webhook`, `worker.image`, `worker.ai`), and publishes to the RabbitMQ Topic Exchange.
   - Updates job status: `READY` $\rightarrow$ `DISPATCHED` upon receiving publisher confirmations (ACK).

3. **Execution Plane** (_How is work actually performed?_):
   - **Specialized Workers**: Decoupled worker deployments consuming from targeted queues (`email.queue`, `webhook.queue`, `image.queue`, `ai.queue`).
   - Workers execute business tasks and persist run details (`started_at`, `finished_at`, `error_message`) into the **`Executions`** table.
   - Status lifecycle: `READY` $\rightarrow$ `DISPATCHED` $\rightarrow$ `RUNNING` $\rightarrow$ `SUCCEEDED` / `FAILED`.

## Project Structure

```text
distributed-task-scheduler/
├── scheduler-api/             # API Gateway & Scheduler Service (Schedules CRUD & intent)
├── timer-service/             # High-precision timer store & schedule trigger engine
├── scanner-service/           # Partitioned scanner promoting due schedules to READY jobs
├── dispatcher-service/        # Batch reader publishing READY jobs to RabbitMQ Topic Exchange
├── worker-service/            # Specialized execution workers (Email, Webhook, Image, AI)
├── cron-service/              # Cron expression parser & recurring schedule evaluator
├── coordinator-service/       # Leader election, partition leasing, and Redis locking
├── notification-service/      # Event-driven notification and webhook service
├── shared/                    # Monorepo shared modules (proto, common, config, logger, database)
│   ├── proto/                 # Protocol buffer definitions for gRPC & IPC
│   ├── common/                # Shared utilities, types, and constants
│   ├── config/                # Environment configuration management
│   └── logger/                # Structured JSON logging initialization
├── docker/                    # Docker Compose specs & local infrastructure
├── kubernetes/                # Kubernetes manifests, Helm charts, and Kustomize overlays
└── scripts/                   # Setup, build, migration, and automation scripts
```

## Infrastructure

Local development infrastructure is managed via Docker Compose.

### Quick Start

```bash
# Start all local infrastructure services (PostgreSQL, Redis, RabbitMQ, Prometheus, Grafana, Jaeger)
npm run docker:up

# View container logs
npm run docker:logs

# Stop infrastructure services
npm run docker:down
```

### Infrastructure Services & Endpoints

| Service           | Host Port | Internal Port | Description / UI Link                                                      |
| :---------------- | :-------- | :------------ | :------------------------------------------------------------------------- |
| **PostgreSQL**    | `5432`    | `5432`        | Primary Relational Database (`scheduler_db`)                               |
| **Redis**         | `6379`    | `6379`        | Cache & In-Memory Store                                                    |
| **RabbitMQ AMQP** | `5672`    | `5672`        | Message Broker AMQP Port                                                   |
| **RabbitMQ UI**   | `15672`   | `15672`       | [http://localhost:15672](http://localhost:15672) (`guest`/`guest`)         |
| **Prometheus**    | `9090`    | `9090`        | [http://localhost:9090](http://localhost:9090) Metrics Collector           |
| **Grafana**       | `3000`    | `3000`        | [http://localhost:3000](http://localhost:3000) Dashboard (`admin`/`admin`) |
| **Jaeger**        | `16686`   | `16686`       | [http://localhost:16686](http://localhost:16686) Distributed Tracing UI    |

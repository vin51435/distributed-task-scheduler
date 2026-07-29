# Distributed Task Scheduler

A fault-tolerant, highly available, and scalable distributed task scheduling and execution system.

## Project Architecture & Structure

```
distributed-task-scheduler/
├── README.md
├── docs/                      # Comprehensive architectural documentation
│   ├── 01-project-vision.md
│   ├── 02-requirements.md
│   ├── 03-distributed-systems-fundamentals.md
│   ├── 04-high-level-architecture.md
│   ├── 05-service-architecture.md
│   ├── 06-infrastructure.md
│   ├── 07-technology-decisions.md
│   ├── 08-rest-api.md
│   ├── 09-grpc.md
│   ├── 10-internal-communication.md
│   ├── 11-postgresql.md
│   ├── 12-redis.md
│   ├── 13-rabbitmq.md
│   ├── 14-minio.md
│   ├── 15-timer-store.md
│   ├── 16-scanner.md
│   ├── 17-cron-engine.md
│   ├── 18-dispatcher.md
│   ├── 19-worker.md
│   ├── 20-idempotency.md
│   ├── 21-retries.md
│   ├── 22-distributed-coordination.md
│   ├── 23-scheduling-algorithms.md
│   ├── 24-fault-tolerance.md
│   ├── 25-notification-service.md
│   ├── 26-audit-service.md
│   ├── 27-logging.md
│   ├── 28-metrics.md
│   ├── 29-distributed-tracing.md
│   ├── 30-security.md
│   ├── 31-local-development.md
│   ├── 32-kubernetes.md
│   ├── 33-cloud-deployment.md
│   ├── 34-testing.md
│   └── 35-development-roadmap.md
│
├── scheduler-api/             # REST/gRPC API Gateway for task creation & management
├── timer-service/             # High-precision timer store & trigger service
├── scanner-service/           # Partitioned database scanner for due tasks
├── worker-service/            # Scalable task execution worker node service
├── cron-service/              # Cron expression parser & schedule producer
├── coordinator-service/       # Leader election, partition management, and cluster state
├── notification-service/      # Task status webhook and alert notification engine
├── shared/                    # Shared code, schemas, and helper modules
│   ├── proto/                 # Protocol buffer definitions for gRPC & IPC
│   ├── common/                # Core utilities, types, and constants
│   ├── config/                # Environment and dynamic config handlers
│   └── logger/                # Structured logging initialization & formatters
│
├── docker/                    # Dockerfiles, Compose specs, and dev containers
├── kubernetes/                # Kubernetes manifests, Helm charts, and Kustomize overlays
└── scripts/                   # Setup, build, migration, and automation scripts
```

## Getting Started

Refer to [01-project-vision.md](docs/01-project-vision.md) and [31-local-development.md](docs/31-local-development.md) for documentation on setup, architecture, and local environment execution.

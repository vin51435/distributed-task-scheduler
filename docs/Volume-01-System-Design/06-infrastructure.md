# Chapter 6 — Infrastructure Architecture

**Document:** Distributed Task Scheduler Platform
**Chapter:** 6
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Infrastructure Philosophy
3. Local Development Infrastructure
4. Production Infrastructure
5. Infrastructure Components
6. Docker Architecture
7. Docker Compose Architecture
8. Networking
9. Persistent Storage
10. Environment Variables
11. Configuration Management
12. Service Discovery
13. Secrets Management
14. Observability Infrastructure
15. Startup Sequence
16. Failure Recovery
17. Infrastructure Scaling
18. Infrastructure Evolution
19. Chapter Summary

---

# 6.1 Introduction

Software does not run in isolation. Every distributed application depends on infrastructure that provides networking, storage, messaging, caching, monitoring, and orchestration.

For the scheduler, infrastructure is responsible for:

- Running services
- Connecting services
- Persisting data
- Managing communication
- Monitoring health
- Recovering from failures

This chapter defines the infrastructure required to run the scheduler locally and in production.

---

# 6.2 Infrastructure Philosophy

The infrastructure follows four principles:

### 1. Local First

Every developer should be able to run the complete platform on a laptop.

```text
docker compose up
```

should start the complete scheduler.

---

### 2. Production Similarity

The local environment should closely resemble production.

The same services used locally should also be deployed to Kubernetes later.

---

### 3. Containerization

Every deployable component runs inside its own Docker container.

Benefits include:

- portability
- reproducibility
- isolation
- simplified deployment

---

### 4. Infrastructure as Code

Infrastructure configuration belongs in version control.

Examples:

- Docker Compose
- Kubernetes manifests
- environment files
- monitoring configuration

---

# 6.3 Local Development Infrastructure

The complete local environment consists of the following services.

```text
                     Docker Compose
                           │
     ┌──────────────────────────────────────┐
     │                                      │
 API Service           PostgreSQL
 Timer Service         Redis
 Scanner Service       RabbitMQ
 Worker Service        MinIO
 Cron Service          Prometheus
 Coordinator           Grafana
 Notification          Loki
 Audit                 Jaeger
     │                                      │
     └──────────────────────────────────────┘
```

All services communicate over a Docker bridge network.

---

# 6.4 Production Infrastructure

In production, Docker Compose is replaced with Kubernetes.

```text
Internet
     │
Load Balancer
     │
Ingress Controller
     │
Kubernetes Cluster
     │
Pods
```

Each microservice becomes one or more Kubernetes Pods.

Infrastructure services such as PostgreSQL and RabbitMQ may run either inside the cluster or as managed cloud services.

---

# 6.5 Infrastructure Components

| Component      | Purpose                     |
| -------------- | --------------------------- |
| Docker         | Container runtime           |
| Docker Compose | Local orchestration         |
| PostgreSQL     | Persistent timer storage    |
| RabbitMQ       | Message broker              |
| Redis          | Coordination, cache, leases |
| MinIO          | Object storage              |
| Prometheus     | Metrics collection          |
| Grafana        | Dashboards                  |
| Loki           | Log aggregation             |
| Jaeger         | Distributed tracing         |

These components collectively form the platform on which the scheduler operates.

---

# 6.6 Docker Architecture

Each service is packaged independently.

Example:

```text
api-service/

├── Dockerfile
├── package.json
└── src/
```

Each Docker image contains:

- Node.js runtime
- compiled NestJS application
- environment configuration
- startup command

Example startup:

```text
docker run api-service
```

Each service has its own image so that it can be deployed independently.

---

# 6.7 Docker Compose Architecture

Docker Compose starts all required containers.

Logical layout:

```text
docker-compose.yml

↓

PostgreSQL

Redis

RabbitMQ

↓

Infrastructure Ready

↓

Timer Service

Coordinator

↓

Scanner

↓

Worker

↓

API

↓

Cron

↓

Notification
```

Compose also creates:

- networks
- volumes
- environment injection
- restart policies

---

# 6.8 Networking

All containers communicate through an isolated Docker bridge network.

Example:

```text
scheduler-network

├── api-service
├── timer-service
├── scanner-service
├── worker-service
├── postgres
├── rabbitmq
└── redis
```

Services communicate using container names.

Example:

```text
postgres:5432

rabbitmq:5672

redis:6379
```

No IP addresses are hardcoded.

---

# 6.9 Persistent Storage

Some services require persistent data.

| Service    | Persistence Required |
| ---------- | -------------------- |
| PostgreSQL | Yes                  |
| RabbitMQ   | Yes                  |
| Redis      | Recommended          |
| MinIO      | Yes                  |
| API        | No                   |
| Worker     | No                   |
| Scanner    | No                   |

Persistent volumes ensure data survives container restarts.

---

# 6.10 Environment Variables

Every service receives configuration through environment variables.

Example:

```text
POSTGRES_HOST

POSTGRES_PORT

POSTGRES_USER

POSTGRES_PASSWORD

POSTGRES_DB

RABBITMQ_URL

REDIS_HOST

GRPC_PORT

HTTP_PORT

LOG_LEVEL
```

Configuration should never be hardcoded.

---

# 6.11 Configuration Management

Configuration is divided into categories.

## Infrastructure

```text
DATABASE_URL

REDIS_URL

RABBITMQ_URL
```

---

## Application

```text
PORT

NODE_ENV

SERVICE_NAME
```

---

## Observability

```text
OTEL_EXPORTER

PROMETHEUS_PORT

LOG_LEVEL
```

---

## Security

```text
JWT_SECRET

JWT_EXPIRES_IN
```

Each service loads only the variables it requires.

---

# 6.12 Service Discovery

Services must locate one another dynamically.

Local development:

Docker DNS

Example:

```text
timer-service

↓

postgres
```

Production:

Kubernetes Service

Example:

```text
timer-service.default.svc.cluster.local
```

Services communicate using logical names rather than fixed IP addresses.

---

# 6.13 Secrets Management

Sensitive values must never be committed to source control.

Examples:

- database passwords
- JWT secrets
- SMTP credentials
- API keys

Development:

```text
.env
```

Production:

```text
Kubernetes Secrets
```

Future deployments may integrate with cloud secret managers such as AWS Secrets Manager or HashiCorp Vault.

---

# 6.14 Observability Infrastructure

A production scheduler must be observable.

The observability stack consists of four components.

## Metrics

```text
Application

↓

Prometheus

↓

Grafana
```

Metrics include:

- API requests
- queue depth
- retry count
- scheduling lag
- worker utilization

---

## Logs

```text
Application

↓

Pino

↓

Loki
```

Logs are centralized for searching and troubleshooting.

---

## Traces

```text
API

↓

Timer

↓

Scanner

↓

Worker

↓

Notification
```

↓

Jaeger

Distributed tracing allows a single request to be followed across services.

---

## Dashboards

Grafana displays:

- queue size
- active workers
- failed jobs
- latency
- CPU
- memory
- scanner lag

---

# 6.15 Startup Sequence

Infrastructure components must start in dependency order.

```text
1. PostgreSQL

↓

2. Redis

↓

3. RabbitMQ

↓

4. MinIO

↓

5. Prometheus

↓

6. Loki

↓

7. Jaeger

↓

8. Coordinator

↓

9. Timer Service

↓

10. Scanner

↓

11. Worker

↓

12. API

↓

13. Cron

↓

14. Notification
```

Health checks ensure that dependent services do not start before their dependencies are ready.

---

# 6.16 Failure Recovery

Containers are configured with automatic restart policies.

Example:

```text
Worker crashes

↓

Docker Restart

↓

Worker reconnects

↓

RabbitMQ redelivers message
```

Another example:

```text
Scanner crashes

↓

Lease expires

↓

Another scanner acquires ownership

↓

Promotion continues
```

Infrastructure should recover automatically from common failures without manual intervention.

---

# 6.17 Infrastructure Scaling

Not every component scales equally.

| Component  | Scaling Strategy                         |
| ---------- | ---------------------------------------- |
| API        | Horizontal                               |
| Timer      | Horizontal                               |
| Scanner    | Horizontal                               |
| Worker     | Horizontal                               |
| PostgreSQL | Vertical initially, replicas later       |
| Redis      | Single instance initially, cluster later |
| RabbitMQ   | Single node initially, cluster later     |
| Prometheus | Usually single instance                  |
| Grafana    | Optional horizontal scaling              |

This approach balances simplicity during development with a clear path toward production scalability.

---

# 6.18 Infrastructure Evolution

The infrastructure evolves over time without requiring architectural changes.

### Phase 1

```text
Docker Compose

↓

Single PostgreSQL

↓

Single RabbitMQ

↓

Single Redis
```

---

### Phase 2

```text
Docker Compose

↓

Multiple API

↓

Multiple Workers

↓

Multiple Scanners
```

---

### Phase 3

```text
Kubernetes
```

---

### Phase 4

```text
PostgreSQL Replication

RabbitMQ Cluster

Redis Sentinel
```

---

### Phase 5

```text
Cassandra

etcd

Cloud Object Storage

Managed Monitoring
```

Each phase increases reliability and scalability while preserving the same application architecture.

---

# 6.19 Infrastructure Directory Structure

```text
infrastructure/

├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   └── Dockerfiles/
│
├── kubernetes/
│   ├── deployments/
│   ├── services/
│   ├── ingress/
│   ├── configmaps/
│   ├── secrets/
│   └── monitoring/
│
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   ├── loki/
│   └── jaeger/
│
└── scripts/
    ├── start.sh
    ├── stop.sh
    └── backup.sh
```

Keeping infrastructure separate from application code makes deployment and maintenance easier.

---

# 6.20 Key Infrastructure Decisions

| Decision                            | Reason                            |
| ----------------------------------- | --------------------------------- |
| Docker for all services             | Consistent runtime environment    |
| Docker Compose for development      | Simple local orchestration        |
| Kubernetes for production           | High availability and autoscaling |
| PostgreSQL for persistent storage   | Strong transactional guarantees   |
| RabbitMQ for asynchronous execution | Reliable message delivery         |
| Redis for coordination              | Fast in-memory operations         |
| Prometheus + Grafana                | Metrics and dashboards            |
| Loki                                | Centralized structured logging    |
| Jaeger                              | End-to-end request tracing        |
| Environment variables               | Portable configuration management |

---

# Chapter Summary

This chapter defined the infrastructure required to operate the Distributed Task Scheduler Platform. We introduced the local Docker Compose environment, the production Kubernetes architecture, networking, persistent storage, service discovery, configuration management, secrets handling, observability infrastructure, startup sequencing, failure recovery, and scaling strategies. These infrastructure decisions provide a stable and reproducible foundation on which the application services can run consistently from local development through production deployment.

---

# Next Chapter

**Chapter 7 — Technology Decisions & Trade-Off Analysis**

The next chapter explains _why_ each technology in the platform was selected. It will compare alternatives such as NestJS vs Express, RabbitMQ vs Kafka vs BullMQ, PostgreSQL vs Cassandra, Redis vs etcd, REST vs gRPC, Docker Compose vs Kubernetes, and discuss the trade-offs, advantages, limitations, and future migration paths for each decision.

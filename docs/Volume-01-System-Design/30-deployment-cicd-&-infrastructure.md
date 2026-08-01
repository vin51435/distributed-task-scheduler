# Chapter 30 — Deployment Architecture, CI/CD & Production Infrastructure

**Document:** Distributed Task Scheduler Platform
**Chapter:** 30 (Final Chapter)
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Deployment Philosophy
3. Local Development Environment
4. Docker Architecture
5. Docker Compose
6. Production Architecture
7. Kubernetes Deployment
8. CI/CD Pipeline
9. Infrastructure as Code
10. Environment Management
11. Deployment Strategies
12. Autoscaling
13. Production Networking
14. Backup Automation
15. Disaster Recovery
16. Production Checklist
17. Future Evolution
18. Final System Architecture
19. Chapter Summary

---

# 30.1 Introduction

Everything designed throughout this document now comes together into a deployable production platform.

The scheduler consists of multiple independently deployable services that work together:

- API Gateway
- Timer Service
- Scanner Service
- Cron Service
- Dispatcher Service
- Worker Service
- Notification Service
- Audit Service

along with infrastructure components:

- PostgreSQL
- RabbitMQ
- Redis
- MinIO
- Prometheus
- Grafana
- Loki

This chapter explains how these services are developed locally, tested, deployed, monitored, updated, and operated in production.

---

# 30.2 Deployment Philosophy

The platform follows several deployment principles:

- Every service runs independently.
- Every service is containerized.
- Services remain stateless.
- Infrastructure stores all persistent state.
- Configuration comes from environment variables.
- Deployments are automated.
- Rollbacks are automated.
- Scaling happens independently.

This architecture allows individual services to evolve without affecting the entire platform.

---

# 30.3 Local Development Environment

During development everything runs locally using Docker Compose.

```text
                Developer Laptop

        ┌──────────────────────────────┐

        │        Docker Compose        │

        ├──────────────────────────────┤

        │ API Gateway                  │

        │ Timer Service                │

        │ Scanner Service              │

        │ Cron Service                 │

        │ Dispatcher Service           │

        │ Worker                       │

        │ Notification Service         │

        │ PostgreSQL                   │

        │ RabbitMQ                     │

        │ Redis                        │

        │ MinIO                        │

        │ Prometheus                   │

        │ Grafana                      │

        │ Loki                         │

        └──────────────────────────────┘
```

Every developer has an identical environment.

---

# 30.4 Docker Architecture

Every service has its own Docker image.

Example:

```text
services/

api/

timer/

scanner/

worker/

notification/

audit/
```

Each service contains:

```text
Dockerfile

↓

NestJS Build

↓

Node Runtime

↓

Container
```

Images are immutable.

Containers are disposable.

---

# 30.5 Docker Compose

Example development stack:

```text
docker-compose.yml

↓

API

↓

PostgreSQL

↓

RabbitMQ

↓

Redis

↓

MinIO

↓

Grafana

↓

Prometheus

↓

Loki
```

Running:

```bash
docker compose up
```

starts the complete scheduler locally.

---

# 30.6 Production Architecture

Production uses Kubernetes.

```text
                      Internet

                          │

                    Load Balancer

                          │

                  Kubernetes Cluster

       ┌─────────────────────────────────────┐

       │ API Pods                            │

       │ Timer Pods                          │

       │ Scanner Pods                        │

       │ Cron Pods                           │

       │ Dispatcher Pods                     │

       │ Worker Pods                         │

       │ Notification Pods                   │

       │ Audit Pods                          │

       └─────────────────────────────────────┘

                          │

      PostgreSQL • RabbitMQ • Redis • MinIO
```

Application services remain stateless.

---

# 30.7 Kubernetes Deployment

Each service receives:

- Deployment
- Service
- ConfigMap
- Secret
- Horizontal Pod Autoscaler
- Network Policy

Example:

```text
Worker Deployment

↓

3 Pods

↓

Auto Scale

↓

10 Pods
```

Kubernetes automatically replaces failed pods.

---

# 30.8 CI/CD Pipeline

Every Git push starts a deployment pipeline.

```text
Developer

↓

Git Push

↓

GitHub

↓

GitHub Actions

↓

Run Tests

↓

Build Docker Images

↓

Push Registry

↓

Deploy Kubernetes
```

The deployment becomes fully automated.

---

## Pipeline Stages

```text
Checkout

↓

Install

↓

Lint

↓

Unit Tests

↓

Integration Tests

↓

Build

↓

Docker

↓

Push Registry

↓

Deploy
```

Only successful builds are deployed.

---

# 30.9 Infrastructure as Code

Infrastructure is defined as code.

Tools include:

- Terraform
- Helm
- Kubernetes YAML

Infrastructure becomes version controlled.

Example:

```text
Git Repository

↓

Terraform

↓

Cloud Infrastructure
```

No manual production configuration.

---

# 30.10 Environment Management

Different environments use different configurations.

```text
Development

↓

Testing

↓

Staging

↓

Production
```

Environment variables include:

- Database URL
- RabbitMQ URL
- Redis URL
- JWT Secret
- SMTP Credentials
- MinIO Endpoint

Configuration never changes application code.

---

# 30.11 Deployment Strategies

---

## Rolling Deployment

```text
Old Pod

↓

New Pod

↓

Old Removed
```

Zero downtime deployment.

---

## Blue-Green Deployment

```text
Blue Environment

↓

Deploy Green

↓

Switch Traffic

↓

Delete Blue
```

Easy rollback.

---

## Canary Deployment

```text
5%

↓

20%

↓

50%

↓

100%
```

New versions gradually receive production traffic.

---

# 30.12 Autoscaling

Workers scale according to workload.

Example:

```text
Queue Depth

↓

High

↓

More Worker Pods
```

Low activity:

```text
Few Jobs

↓

Scale Down
```

Example policy:

| Queue Depth | Workers |
| ----------- | ------- |
| 100         | 2       |
| 1000        | 5       |
| 5000        | 10      |
| 10000       | 20      |

Autoscaling reduces infrastructure costs.

---

# 30.13 Production Networking

External traffic:

```text
Internet

↓

HTTPS

↓

Load Balancer

↓

API Gateway
```

Internal traffic:

```text
API

↓

gRPC

↓

Timer

↓

Scanner

↓

Worker
```

All communication uses:

- TLS
- mTLS (internal)
- Network Policies

---

# 30.14 Backup Automation

Nightly backups:

```text
PostgreSQL

↓

Backup

↓

Compress

↓

MinIO

↓

Verify

↓

Retention Policy
```

Metrics:

- Backup Success
- Backup Duration
- Restore Verification

Backups are useless unless restoration is tested regularly.

---

# 30.15 Disaster Recovery

Complete recovery procedure:

```text
Provision Infrastructure

↓

Restore PostgreSQL

↓

Restore MinIO

↓

Restore Secrets

↓

Deploy Kubernetes

↓

Restore Monitoring

↓

Resume Scheduling
```

Recovery objectives:

| Objective | Target    |
| --------- | --------- |
| RTO       | <15 min   |
| RPO       | Near Zero |

---

# 30.16 Production Checklist

Before production deployment verify:

### Infrastructure

- PostgreSQL replication
- RabbitMQ clustering
- Redis Sentinel
- MinIO redundancy

---

### Security

- HTTPS enabled
- mTLS enabled
- JWT configured
- Secrets rotated

---

### Monitoring

- Prometheus running
- Grafana dashboards
- Loki healthy
- Alerts configured

---

### Reliability

- Backup verified
- Restore tested
- Autoscaling enabled
- Health checks configured

---

### Performance

- Load tested
- Stress tested
- Failover tested
- Recovery tested

---

# 30.17 Future Evolution

### Phase 1

```text
Docker Compose
```

↓

### Phase 2

```text
Kubernetes
```

↓

### Phase 3

```text
Multi-AZ Deployment
```

↓

### Phase 4

```text
Multi-Region Deployment
```

↓

### Phase 5

```text
Global Active-Active

Distributed Scheduler
```

Each evolution improves availability without changing the application's architecture.

---

# 30.18 Complete System Architecture

```text
                           Users
                              │
                        HTTPS / REST
                              │
                      API Gateway (NestJS)
                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
      Timer Service      Cron Service      Audit Service
          │                   │                    │
          └──────────────┬────┴────────────────────┘
                         │
                    PostgreSQL
                         │
                  Scanner Service
                         │
                 Dispatcher Service
                         │
                     RabbitMQ
                         │
          ┌──────────────┼──────────────┐
          │              │              │
      Worker A       Worker B      Worker C
          │              │              │
          └──────────────┼──────────────┘
                         │
               Business Integrations
                         │
     Email • SMS • Webhooks • External APIs

---------------------------------------------------------

Infrastructure Layer

Redis          → Coordination & Cache

MinIO          → Backups & Object Storage

Prometheus     → Metrics

Grafana        → Dashboards

Loki           → Centralized Logs

OpenTelemetry  → Distributed Tracing
```

---

# 30.19 Technology Stack Summary

| Layer                  | Technology            |
| ---------------------- | --------------------- |
| Language               | TypeScript            |
| Framework              | NestJS                |
| API                    | REST                  |
| Internal Communication | gRPC                  |
| Scheduler Storage      | PostgreSQL            |
| Cache                  | Redis                 |
| Message Broker         | RabbitMQ              |
| Object Storage         | MinIO                 |
| Monitoring             | Prometheus            |
| Dashboard              | Grafana               |
| Logging                | Loki                  |
| Tracing                | OpenTelemetry         |
| Containers             | Docker                |
| Local Development      | Docker Compose        |
| Orchestration          | Kubernetes            |
| CI/CD                  | GitHub Actions        |
| Infrastructure         | Terraform             |
| Reverse Proxy          | NGINX / Load Balancer |
| Cloud                  | AWS / DigitalOcean    |

---

# 30.20 Best Practices

The platform follows these architectural principles:

- Design every service to be stateless.
- Store persistent data only in infrastructure services.
- Automate builds and deployments.
- Version infrastructure alongside application code.
- Deploy using rolling or canary strategies.
- Monitor every component.
- Test backup and recovery procedures regularly.
- Scale services independently.
- Keep configuration externalized.
- Continuously measure system health and performance.

---

# Final Chapter Summary

This chapter completed the production architecture of the Distributed Task Scheduler Platform by bringing together all previously designed components into a deployable, scalable, and resilient system. We explored local development with Docker Compose, containerization, Kubernetes orchestration, CI/CD with GitHub Actions, infrastructure as code using Terraform, environment management, deployment strategies, autoscaling, secure networking, backup automation, disaster recovery, and production readiness.

Together, the **30 chapters** define a comprehensive engineering blueprint for building a modern distributed task scheduler using **NestJS**, **gRPC**, **PostgreSQL**, **RabbitMQ**, **Redis**, **MinIO**, **OpenTelemetry**, **Prometheus**, **Grafana**, **Loki**, **Docker**, and **Kubernetes**. The resulting architecture supports reliable scheduling, recurring jobs, retries, idempotent execution, distributed coordination, horizontal scalability, observability, security, and cloud-native deployment practices suitable for production workloads ranging from small applications to enterprise-scale platforms.

---

# End of Design Document

**Distributed Task Scheduler Platform — Complete System Design (30 Chapters)**

This concludes the design specification. A natural continuation beyond this document would be implementation-focused volumes, such as:

- **Volume 2:** Database schema design (every table, index, migration, partitioning strategy)
- **Volume 3:** NestJS implementation (project structure, modules, services, gRPC contracts, DTOs, code)
- **Volume 4:** DevOps implementation (Docker, Kubernetes, Helm, Terraform, GitHub Actions)
- **Volume 5:** Testing strategy (unit, integration, load, chaos, end-to-end, disaster recovery)
- **Volume 6:** API reference (REST and gRPC specifications, OpenAPI, protobuf definitions)

These volumes would move from architecture into a complete, production-ready implementation.

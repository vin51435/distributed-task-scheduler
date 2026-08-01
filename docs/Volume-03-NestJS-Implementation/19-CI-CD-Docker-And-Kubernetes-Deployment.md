# Filename

**`V3-C19-CI-CD-Docker-And-Kubernetes-Deployment.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 19 — CI/CD Pipelines, Docker, Kubernetes & Production Deployment

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 19

**Filename:** `V3-C19-CI-CD-Docker-And-Kubernetes-Deployment.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Deployment Philosophy
3. CI/CD Architecture
4. Docker Architecture
5. Docker Compose
6. GitHub Actions
7. Container Registry
8. Kubernetes Architecture
9. ConfigMaps & Secrets
10. Rolling Deployments
11. Horizontal Scaling
12. Helm Charts
13. Production Strategy
14. Disaster Recovery
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 19.1 Introduction

Up to this point we have built the application itself.

Now we need to answer:

- How is it built?
- How is it tested?
- How is it packaged?
- How is it deployed?
- How is it updated?
- How is it scaled?
- How is downtime avoided?

This chapter designs the deployment pipeline from a developer's laptop to production.

---

# 19.2 Deployment Philosophy

Every deployment should be:

- Automated
- Repeatable
- Versioned
- Observable
- Rollback-safe
- Zero-downtime

Developers should never manually copy files to production servers.

Instead:

```text id="kt92x4"
Git Push

↓

CI

↓

Docker Image

↓

Registry

↓

Kubernetes

↓

Production
```

---

# 19.3 Overall CI/CD Architecture

```text id="njlwmc"
Developer

↓

GitHub

↓

GitHub Actions

↓

Unit Tests

↓

Integration Tests

↓

Docker Build

↓

Container Registry

↓

Kubernetes Deployment

↓

Production
```

Everything is automated.

---

# 19.4 Development Environment

Local development uses Docker Compose.

```text id="7gc6kh"
NestJS Services

↓

Docker Compose

↓

PostgreSQL

Redis

RabbitMQ

Prometheus

Grafana

Jaeger
```

Developers need only one command.

```text id="0a8wb7"
docker compose up
```

---

# 19.5 Docker Architecture

Each microservice has its own image.

```text id="j3mb6t"
Gateway

Scheduler

Worker

Notification

Identity

Audit

Monitoring

Configuration
```

Every image contains:

```text id="9fzhny"
Node.js

NestJS

Compiled Application

Dependencies
```

Nothing else.

---

# 19.6 Multi-Stage Docker Build

Build process:

```text id="7l3ok9"
Source Code

↓

Dependencies

↓

Compile

↓

Production Image
```

Stages:

```text id="r2ch5q"
Builder

↓

Runtime
```

Benefits:

- Smaller images
- Faster startup
- Reduced attack surface

---

# 19.7 Image Structure

Typical image:

```text id="jlwmi0"
node:22-alpine

↓

dist/

↓

node_modules/

↓

package.json

↓

start.sh
```

Images should be immutable.

Never modify containers after deployment.

---

# 19.8 GitHub Actions Pipeline

Pipeline stages:

```text id="0mjlwm"
Checkout

↓

Install

↓

Lint

↓

Type Check

↓

Unit Tests

↓

Integration Tests

↓

Build

↓

Docker Image

↓

Push Registry

↓

Deploy
```

Failures stop the pipeline immediately.

---

# 19.9 Build Matrix

Each service builds independently.

```text id="h6m8ws"
Gateway

Scheduler

Worker

Notification

Identity
```

Independent builds:

- Faster CI
- Smaller deployments
- Easier rollbacks

---

# 19.10 Container Registry

Images are stored centrally.

Example:

```text id="jqp7nt"
scheduler:1.0.5

worker:1.0.5

gateway:1.0.5

notification:1.0.5
```

Images are versioned.

Deployments reference immutable image tags.

---

# 19.11 Kubernetes Architecture

Production:

```text id="z5tk1d"
Internet

↓

Load Balancer

↓

Ingress

↓

Gateway Pods

↓

Internal Services
```

Every service runs as multiple Pods.

---

# 19.12 Kubernetes Objects

Each service typically contains:

```text id="1yru5k"
Deployment

Service

ConfigMap

Secret

HPA

PodDisruptionBudget
```

Infrastructure is defined declaratively.

---

# 19.13 Deployment Example

Scheduler:

```text id="mt1dxt"
Deployment

↓

3 Replicas

↓

Pods

↓

scheduler:1.0.5
```

Scaling:

```text id="lvjlwm"
3

↓

6

↓

12 Pods
```

No application changes required.

---

# 19.14 ConfigMaps

Configuration should not be baked into images.

Instead:

```text id="dvvgto"
Application

↓

ConfigMap

↓

Runtime Configuration
```

Examples:

- Ports
- Feature flags
- Timeouts
- Retry policies

---

# 19.15 Secrets

Sensitive values remain outside images.

Examples:

```text id="pbmnqb"
Database Password

JWT Keys

RabbitMQ Password

Redis Password

SMTP Credentials
```

Stored as:

```text id="7zzljn"
Kubernetes Secrets
```

Never commit secrets to Git.

---

# 19.16 Horizontal Pod Autoscaler (HPA)

Kubernetes automatically scales services.

Example:

```text id="qjlwm4"
CPU > 70%

↓

Scale

↓

3 Pods

↓

6 Pods
```

Scaling metrics may include:

- CPU
- Memory
- Queue depth
- Custom Prometheus metrics

---

# 19.17 Rolling Updates

New version:

```text id="jlwm92"
Version 1

↓

Version 2
```

Deployment:

```text id="2ytjlwm"
Old Pod

↓

New Pod

↓

Healthy?

↓

Terminate Old Pod
```

Users experience no downtime.

---

# 19.18 Readiness Checks

Before receiving traffic:

```text id="jlwm03"
Pod

↓

Started

↓

Database Connected

↓

Redis Connected

↓

RabbitMQ Connected

↓

Ready
```

Only then does Kubernetes route traffic.

---

# 19.19 Liveness Checks

Kubernetes periodically verifies:

```text id="jlwm10"
Application Alive?
```

Failure:

```text id="jlwm11"
Restart Pod
```

Applications recover automatically.

---

# 19.20 Helm Charts

Instead of dozens of YAML files:

```text id="jlwm12"
Helm Chart

↓

Templates

↓

Values

↓

Deployment
```

Benefits:

- Reusable
- Versioned
- Environment-specific

---

# 19.21 Environment Strategy

Environments:

```text id="jlwm13"
Development

↓

Testing

↓

Staging

↓

Production
```

Same application.

Different configuration.

Never maintain separate codebases.

---

# 19.22 Blue-Green Deployment

Two environments exist simultaneously.

```text id="jlwm14"
Blue

↓

Production
```

Deploy:

```text id="jlwm15"
Green

↓

Testing
```

Switch traffic:

```text id="jlwm16"
Blue

↓

Green
```

Rollback becomes instant.

---

# 19.23 Canary Deployment

Instead of switching all users:

```text id="jlwm17"
5%

↓

20%

↓

50%

↓

100%
```

Traffic gradually shifts.

Problems affect only a small percentage of users.

---

# 19.24 Disaster Recovery

Suppose Kubernetes cluster fails.

Recovery requires:

```text id="jlwm18"
Infrastructure

↓

Helm Charts

↓

Container Images

↓

PostgreSQL Backup

↓

Redis

↓

RabbitMQ
```

Everything can be recreated automatically.

---

# 19.25 Scheduler Deployment Example

Worker Deployment:

```text id="jlwm19"
Deployment

↓

10 Pods

↓

RabbitMQ

↓

Consume Jobs

↓

Scale Automatically
```

Scheduler Deployment:

```text id="jlwm20"
3 Pods

↓

Leader Election

↓

One Active Scanner
```

Deployment strategy reflects service responsibilities.

---

# 19.26 Complete Production Architecture

```text id="jlwm21"
Internet

↓

Load Balancer

↓

Ingress

↓

Gateway

↓

gRPC

↓

Scheduler

Worker

Identity

Notification

↓

Redis

RabbitMQ

PostgreSQL

↓

Prometheus

Grafana

Jaeger
```

Everything runs inside Kubernetes.

---

# 19.27 Performance Considerations

Recommendations:

- Use small Docker images.
- Prefer multi-stage builds.
- Keep containers stateless.
- Use readiness probes.
- Use liveness probes.
- Configure resource requests and limits.
- Autoscale using meaningful metrics.
- Roll out gradually.
- Monitor deployment health.
- Practice disaster recovery regularly.

---

# 19.28 Future Evolution

Current:

```text id="jlwm22"
Docker

GitHub Actions

Kubernetes
```

↓

Future:

```text id="jlwm23"
ArgoCD
```

↓

```text id="jlwm24"
GitOps
```

↓

```text id="jlwm25"
Progressive Delivery
```

↓

```text id="jlwm26"
Multi-Cluster Kubernetes
```

↓

```text id="jlwm27"
Multi-Region Deployment
```

↓

```text id="jlwm28"
Self-Healing Infrastructure
```

Deployment evolves independently from application code.

---

# 19.29 Best Practices

- Automate the entire deployment pipeline.
- Build immutable Docker images.
- Keep configuration outside containers.
- Store secrets securely.
- Use Kubernetes Deployments for every service.
- Configure readiness and liveness probes.
- Autoscale based on real workload metrics.
- Prefer rolling or canary deployments.
- Version every Docker image.
- Treat infrastructure as code.

---

# Chapter Summary

This chapter designed the complete deployment pipeline for the Distributed Task Scheduler Platform. We covered Docker, Docker Compose, GitHub Actions, container registries, Kubernetes Deployments, ConfigMaps, Secrets, Horizontal Pod Autoscalers, rolling updates, canary deployments, Helm charts, disaster recovery, and production deployment strategies. Together these practices create a repeatable, scalable, and highly available deployment process capable of supporting a production-grade distributed microservices platform.

---

# Next Chapter

**Filename:** `V3-C20-Project-Structure-Monorepo-And-Code-Organization.md`

**Chapter 20 — Monorepo Architecture, Nx Workspace & Code Organization**

The next chapter will design the complete repository structure for the scheduler platform. We will organize the Nx monorepo, shared packages, libraries, applications, generated code, protobuf contracts, infrastructure modules, domain modules, testing layout, build configuration, dependency boundaries, and coding conventions, creating a scalable project structure that can support years of development without becoming difficult to maintain.

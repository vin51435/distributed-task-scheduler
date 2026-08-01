# Filename

**`V3-C20-Project-Structure-Monorepo-And-Code-Organization.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 20 — Monorepo Architecture, Nx Workspace & Code Organization

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 20

**Filename:** `V3-C20-Project-Structure-Monorepo-And-Code-Organization.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why a Monorepo?
3. Nx Workspace
4. Repository Structure
5. Applications
6. Shared Libraries
7. Domain Libraries
8. Infrastructure Libraries
9. Generated Code
10. Shared Types
11. Dependency Rules
12. Build Strategy
13. Coding Standards
14. Scalability
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 20.1 Introduction

Our platform consists of many independent services:

- API Gateway
- Identity
- Scheduler
- Scanner
- Dispatcher
- Worker
- Notification
- Audit
- Monitoring
- Configuration

Each service could live in its own Git repository.

Instead, we will use a **Monorepo**.

This chapter defines the complete repository organization for the platform.

---

# 20.2 Why a Monorepo?

Two common approaches exist.

### Multi-Repository

```text
gateway/

scheduler/

worker/

notification/

identity/
```

Advantages:

- Independent repositories
- Independent permissions

Disadvantages:

- Duplicate code
- Difficult refactoring
- Dependency management
- Multiple CI pipelines

---

### Monorepo

```text
scheduler-platform/

├── apps/

├── packages/

├── tools/

└── infrastructure/
```

Advantages:

- Shared libraries
- Easier refactoring
- Single CI pipeline
- Atomic commits
- Consistent tooling
- Easier code sharing

For this platform, a monorepo is the better choice.

---

# 20.3 Why Nx?

Although a monorepo can be managed manually, **Nx** provides tooling specifically designed for large repositories.

Benefits include:

- Project graph visualization
- Incremental builds
- Distributed task execution
- Dependency boundary enforcement
- Affected project detection
- Shared generators
- Consistent workspace configuration

Nx allows dozens of applications and libraries to scale without slowing development.

---

# 20.4 High-Level Repository Structure

```text
scheduler-platform/

├── apps/

├── packages/

├── proto/

├── tools/

├── infrastructure/

├── docker/

├── kubernetes/

├── scripts/

├── docs/

├── .github/

├── nx.json

├── package.json

└── tsconfig.base.json
```

Everything lives in one repository.

---

# 20.5 Applications

Each deployable microservice lives inside `apps/`.

```text
apps/

├── gateway/

├── identity/

├── scheduler/

├── scanner/

├── dispatcher/

├── worker/

├── notification/

├── audit/

├── monitoring/

└── configuration/
```

Each application produces one Docker image.

Applications should contain very little reusable code.

---

# 20.6 Typical Application Structure

Example:

```text
apps/scheduler/

src/

├── main.ts

├── app.module.ts

├── controllers/

├── services/

├── grpc/

├── config/

├── modules/

├── health/

└── bootstrap/
```

The application composes libraries.

Business logic belongs in shared libraries wherever possible.

---

# 20.7 Packages Directory

Shared code lives inside `packages/`.

```text
packages/

├── database/

├── grpc/

├── rabbitmq/

├── redis/

├── observability/

├── authentication/

├── authorization/

├── protobuf/

├── shared/

├── testing/

├── configuration/

└── utilities/
```

Applications consume these packages.

Packages should never depend on applications.

---

# 20.8 Domain Libraries

Business domains are separated.

```text
packages/domain/

├── scheduler/

├── execution/

├── notification/

├── identity/

├── audit/

├── monitoring/

└── configuration/
```

Each domain contains:

- Entities
- DTOs
- Business services
- Validation
- Domain events

Domain logic remains independent of infrastructure.

---

# 20.9 Infrastructure Libraries

Infrastructure concerns are isolated.

```text
packages/infrastructure/

├── postgres/

├── redis/

├── rabbitmq/

├── grpc/

├── logging/

├── metrics/

├── tracing/

├── caching/

├── security/

└── health/
```

These libraries wrap external technologies.

Business services interact with abstractions rather than implementation details.

---

# 20.10 Generated Code

Generated code should never be edited manually.

```text
packages/protobuf/

generated/

├── scheduler/

├── worker/

├── identity/

├── notification/

└── common/
```

Sources:

```text
proto/

↓

Code Generator

↓

Generated SDK
```

Applications import generated code only.

---

# 20.11 Database Library

Database code remains centralized.

```text
packages/database/

├── entities/

├── repositories/

├── migrations/

├── subscribers/

├── seeds/

├── datasource/

└── utils/
```

Every service uses the same database abstractions.

---

# 20.12 Shared Utilities

Reusable helpers belong here.

```text
packages/shared/

├── constants/

├── decorators/

├── filters/

├── interceptors/

├── exceptions/

├── guards/

├── pipes/

├── validators/

├── helpers/

└── types/
```

Avoid duplicating utility code across services.

---

# 20.13 Testing Library

Testing infrastructure is shared.

```text
packages/testing/

├── mocks/

├── fixtures/

├── factories/

├── builders/

├── testcontainers/

├── helpers/

└── assertions/
```

Every service uses the same testing utilities.

---

# 20.14 Infrastructure Folder

Infrastructure-as-Code lives separately.

```text
infrastructure/

├── terraform/

├── helm/

├── kubernetes/

├── monitoring/

├── networking/

└── security/
```

Application code and infrastructure remain independent.

---

# 20.15 Docker Directory

Container definitions:

```text
docker/

├── gateway/

├── scheduler/

├── worker/

├── notification/

├── compose/

└── base/
```

Every application has its own Dockerfile.

Shared base images reduce duplication.

---

# 20.16 Proto Directory

Contracts remain centralized.

```text
proto/

├── scheduler.proto

├── worker.proto

├── identity.proto

├── notification.proto

├── audit.proto

├── monitoring.proto

├── configuration.proto

└── common.proto
```

This directory is the single source of truth for internal APIs.

---

# 20.17 Dependency Rules

Applications may depend on:

```text
Apps

↓

Packages
```

Packages may depend on:

```text
Packages

↓

Shared Packages
```

Forbidden:

```text
Package

↓

Application
```

This prevents circular dependencies.

---

# 20.18 Layered Dependency Graph

```text
Applications

↓

Domain Libraries

↓

Infrastructure Libraries

↓

Shared Libraries

↓

External Dependencies
```

Dependencies always flow downward.

Never upward.

---

# 20.19 Build Strategy

Nx builds only affected projects.

Example:

```text
Change

↓

Worker Library
```

Rebuild:

```text
Worker

Notification
```

Do **not** rebuild:

```text
Gateway

Identity
```

Incremental builds dramatically reduce CI time.

---

# 20.20 Code Ownership

Ownership can be defined per directory.

Example:

```text
apps/scheduler/

↓

Scheduler Team
```

```text
packages/authentication/

↓

Platform Team
```

This improves large-team collaboration.

---

# 20.21 Coding Standards

Every package follows the same standards.

Examples:

- ESLint
- Prettier
- TypeScript strict mode
- Conventional commits
- Husky pre-commit hooks
- Commit linting

Consistency improves maintainability.

---

# 20.22 Repository Documentation

Documentation lives with the code.

```text
docs/

├── architecture/

├── api/

├── deployment/

├── development/

├── diagrams/

├── decisions/

└── runbooks/
```

Every architectural decision should be documented.

---

# 20.23 Scheduler Example

A new feature:

```text
Recurring Job Retry
```

Touches:

```text
packages/domain/scheduler/

↓

packages/database/

↓

apps/scheduler/

↓

proto/

↓

tests/
```

All related changes are committed together in one pull request.

This is one of the major advantages of a monorepo.

---

# 20.24 Complete Repository Architecture

```text
scheduler-platform/

├── apps/

├── packages/

│   ├── domain/

│   ├── infrastructure/

│   ├── shared/

│   ├── protobuf/

│   └── testing/

├── proto/

├── infrastructure/

├── docker/

├── kubernetes/

├── docs/

├── tools/

└── scripts/
```

The repository scales cleanly as new services are added.

---

# 20.25 Performance Considerations

Recommendations:

- Use Nx affected builds.
- Keep libraries focused.
- Avoid circular dependencies.
- Generate code automatically.
- Share infrastructure modules.
- Keep applications thin.
- Enforce dependency boundaries.
- Cache builds in CI.
- Use project graph analysis.
- Periodically review library organization.

---

# 20.26 Future Evolution

Current:

```text
Nx Monorepo
```

↓

Future:

```text
Distributed Build Cache
```

↓

```text
Nx Cloud
```

↓

```text
Remote Task Execution
```

↓

```text
Automatic Dependency Analysis
```

↓

```text
AI-Assisted Code Generation
```

↓

```text
Large Multi-Team Platform
```

The repository structure is designed to support years of growth.

---

# 20.27 Best Practices

- Keep one monorepo for the entire platform.
- Use Nx for workspace management.
- Keep applications thin.
- Place reusable code in libraries.
- Separate domain and infrastructure.
- Generate protobuf code automatically.
- Enforce dependency boundaries.
- Organize documentation alongside code.
- Treat infrastructure as code.
- Design libraries for long-term reuse.

---

# Chapter Summary

This chapter designed the complete monorepo architecture for the Distributed Task Scheduler Platform. We organized the Nx workspace into applications, domain libraries, infrastructure libraries, shared packages, generated protobuf code, testing utilities, Docker assets, Kubernetes manifests, and documentation. By enforcing clear dependency boundaries and reusable libraries, the repository remains scalable, maintainable, and efficient for both individual developers and large engineering teams.

---

# Next Chapter

**Filename:** `V3-C21-Local-Development-Environment-And-Developer-Workflow.md`

**Chapter 21 — Local Development Environment, Developer Workflow & Productivity**

The next chapter will design the complete local development experience. We will cover setting up the Nx workspace, Docker Compose, PostgreSQL, Redis, RabbitMQ, Prometheus, Grafana, Jaeger, hot reload, debugging multiple NestJS services, VS Code configuration, local Kubernetes with Kind/Minikube, Git workflow, branch strategy, code generation, and daily developer workflows for efficiently building and testing the distributed scheduler platform.

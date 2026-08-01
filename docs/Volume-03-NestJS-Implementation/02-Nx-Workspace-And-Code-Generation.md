# Filename

**`V3-C02-Nx-Workspace-And-Code-Generation.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 2 — Creating the Nx Workspace & Bootstrapping the Project

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 2

**Filename:** `V3-C02-Nx-Workspace-And-Code-Generation.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Objectives
3. Why Nx Instead of Nest CLI
4. Required Software
5. Workspace Creation
6. Understanding the Workspace
7. Creating Applications
8. Creating Shared Libraries
9. TypeScript Configuration
10. Path Aliases
11. Nx Dependency Graph
12. Code Generation
13. VS Code Configuration
14. Git Strategy
15. Initial Workspace Validation
16. Best Practices
17. Chapter Summary

---

# 2.1 Introduction

In the previous chapter, we designed the overall repository architecture.

We decided to use:

- NestJS
- Nx Monorepo
- TypeScript
- Docker
- PostgreSQL
- RabbitMQ
- Redis
- gRPC

Now we will **actually create the workspace**.

This chapter is the starting point of the real implementation.

After this chapter we will have a workspace capable of hosting every microservice in the scheduler platform.

---

# 2.2 Objectives

At the end of this chapter we will have:

- An Nx workspace
- Multiple NestJS applications
- Shared libraries
- TypeScript path aliases
- Workspace configuration
- Code generation support
- Dependency rules
- VS Code configuration
- Git repository
- Initial project structure

No business logic will be written yet.

We are building the foundation.

---

# 2.3 Why Nx Instead of Nest CLI?

NestJS already supports monorepos.

So why introduce Nx?

Nest CLI provides:

```text
Nest

↓

Generate Module

↓

Generate Controller

↓

Generate Service
```

Nx provides much more:

```text
Nx

↓

Project Graph

↓

Generators

↓

Affected Builds

↓

Task Cache

↓

Dependency Rules

↓

Workspace Management

↓

Distributed Builds
```

As the number of services grows, these features become essential.

---

# 2.4 Required Software

Before creating the workspace, install the following tools.

| Tool                | Version    |
| ------------------- | ---------- |
| Node.js             | Latest LTS |
| npm                 | Latest     |
| Git                 | Latest     |
| Docker Desktop      | Latest     |
| VS Code             | Latest     |
| PostgreSQL Client   | Optional   |
| Redis CLI           | Optional   |
| RabbitMQ Management | Browser    |

---

## Verify Installation

Node:

```bash
node -v
```

npm:

```bash
npm -v
```

Git:

```bash
git --version
```

Docker:

```bash
docker version
```

Everything should work before continuing.

---

# 2.5 Creating the Workspace

Create a new Nx workspace.

```bash
npx create-nx-workspace@latest scheduler-platform
```

Nx asks several questions.

Recommended answers:

```text
Workspace Name

scheduler-platform
```

---

```text
Stack

None
```

We will install NestJS manually for better control.

---

Package Manager:

```text
npm
```

or

```text
pnpm
```

Both are good.

For this project:

```text
npm
```

---

Enable Nx Cloud?

```text
No
```

Can be enabled later.

---

# 2.6 Initial Workspace

After creation:

```text
scheduler-platform/

│

├── nx.json

├── package.json

├── tsconfig.base.json

├── .gitignore

├── README.md
```

Notice that there are no applications yet.

Nx first creates the workspace itself.

---

# 2.7 Install NestJS Plugin

Nx supports multiple frameworks.

Install the Nest plugin.

```bash
npm install -D @nx/nest
```

Now Nx understands NestJS projects.

---

# 2.8 Generate the First Application

Create the API Gateway.

```bash
nx g @nx/nest:application api-gateway
```

Nx automatically creates:

```text
apps/

    api-gateway/

        src/

            main.ts

            app/

                app.module.ts

                app.controller.ts

                app.service.ts
```

The application already compiles.

---

Run it.

```bash
nx serve api-gateway
```

You now have your first NestJS application inside the monorepo.

---

# 2.9 Creating Remaining Applications

Repeat for every service.

```bash
nx g @nx/nest:application scheduler-service
```

```bash
nx g @nx/nest:application scanner-service
```

```bash
nx g @nx/nest:application dispatcher-service
```

```bash
nx g @nx/nest:application worker-service
```

```bash
nx g @nx/nest:application notification-service
```

```bash
nx g @nx/nest:application identity-service
```

```bash
nx g @nx/nest:application audit-service
```

```bash
nx g @nx/nest:application monitoring-service
```

```bash
nx g @nx/nest:application config-service
```

Each application is completely independent.

---

# 2.10 Applications Folder

Result:

```text
apps/

├── api-gateway/

├── scheduler-service/

├── scanner-service/

├── dispatcher-service/

├── worker-service/

├── notification-service/

├── identity-service/

├── audit-service/

├── monitoring-service/

└── config-service/
```

These are deployable applications.

Every folder becomes:

```text
Docker Image

↓

Container

↓

Kubernetes Deployment
```

---

# 2.11 Creating Shared Libraries

Applications should never duplicate code.

Create reusable libraries.

Example:

```bash
nx g @nx/nest:library common
```

Another:

```bash
nx g @nx/nest:library database
```

Continue:

```bash
nx g @nx/nest:library auth

nx g @nx/nest:library logging

nx g @nx/nest:library tracing

nx g @nx/nest:library grpc

nx g @nx/nest:library rabbitmq

nx g @nx/nest:library redis

nx g @nx/nest:library validation

nx g @nx/nest:library protobuf

nx g @nx/nest:library telemetry

nx g @nx/nest:library testing
```

---

# 2.12 Libraries Folder

Result:

```text
packages/

├── common/

├── database/

├── auth/

├── grpc/

├── protobuf/

├── logging/

├── tracing/

├── rabbitmq/

├── redis/

├── telemetry/

├── validation/

└── testing/
```

Notice these are **not applications**.

They cannot run independently.

---

# 2.13 TypeScript Configuration

Nx creates:

```text
tsconfig.base.json
```

This becomes the root TypeScript configuration.

Applications inherit it.

Example:

```text
Root Config

↓

Worker Config

↓

Notification Config
```

Centralized configuration keeps every project consistent.

---

# 2.14 Path Aliases

Instead of:

```typescript
import { Logger } from '../../../../../../logging';
```

Use aliases.

Example:

```typescript
import { LoggerService } from '@scheduler/logging';
```

Another:

```typescript
import { DatabaseModule } from '@scheduler/database';
```

Another:

```typescript
import { RedisModule } from '@scheduler/redis';
```

Aliases improve readability and simplify refactoring.

---

# 2.15 Nx Dependency Graph

Nx automatically understands project relationships.

Command:

```bash
nx graph
```

Output:

```text
api-gateway

↓

common

↓

database

↓

logging

↓

redis
```

Worker:

```text
worker

↓

grpc

↓

rabbitmq

↓

database

↓

common
```

This visualization helps prevent circular dependencies.

---

# 2.16 Code Generation

Nx generates boilerplate automatically.

Generate module:

```bash
nx g @nx/nest:module jobs --project=scheduler-service
```

Generate controller:

```bash
nx g @nx/nest:controller jobs --project=scheduler-service
```

Generate service:

```bash
nx g @nx/nest:service jobs --project=scheduler-service
```

Every generated file follows the same project conventions.

---

# 2.17 VS Code Configuration

Recommended extensions:

```text
NestJS Files

ESLint

Prettier

Docker

GitLens

Error Lens

Nx Console

YAML

Thunder Client
```

Recommended workspace:

```text
.vscode/

    settings.json

    extensions.json

    launch.json

    tasks.json
```

These files should be committed to Git so every developer shares the same setup.

---

# 2.18 Git Strategy

Initialize Git.

```bash
git init
```

Create:

```text
main
```

branch.

Recommended workflow:

```text
main

↓

feature/scanner

↓

feature/dispatcher

↓

feature/retry-system
```

Every feature becomes a separate branch.

---

# 2.19 Initial Workspace Validation

Run:

```bash
nx graph
```

Ensure every project appears.

Then build everything.

```bash
nx run-many --target=build --all
```

Finally run:

```bash
nx run-many --target=test --all
```

If every project builds successfully, the workspace is correctly configured.

---

# 2.20 Final Workspace Structure

```text
scheduler-platform/

├── apps/
│   ├── api-gateway/
│   ├── scheduler-service/
│   ├── scanner-service/
│   ├── dispatcher-service/
│   ├── worker-service/
│   ├── notification-service/
│   ├── identity-service/
│   ├── audit-service/
│   ├── monitoring-service/
│   └── config-service/

├── packages/
│   ├── common/
│   ├── database/
│   ├── auth/
│   ├── grpc/
│   ├── protobuf/
│   ├── rabbitmq/
│   ├── redis/
│   ├── logging/
│   ├── tracing/
│   ├── telemetry/
│   ├── validation/
│   └── testing/

├── docker/

├── infra/

├── proto/

├── docs/

├── scripts/

├── nx.json

├── package.json

├── tsconfig.base.json

└── docker-compose.yml
```

---

# 2.21 Best Practices

- Generate projects with Nx generators rather than manually creating folders.
- Keep applications under `apps/` and reusable code under `packages/`.
- Configure TypeScript aliases from the start.
- Never use relative imports that cross project boundaries.
- Use `nx graph` frequently to detect unwanted dependencies.
- Commit shared VS Code settings.
- Keep the workspace buildable at all times.
- Build only affected projects during development.
- Use Git feature branches for isolated work.
- Treat the workspace as a single cohesive codebase with clearly defined ownership.

---

# Chapter Summary

In this chapter we bootstrapped the Nx workspace that will host the entire distributed scheduler platform. We installed Nx and the NestJS plugin, generated deployable applications and reusable libraries, configured TypeScript path aliases, explored the Nx dependency graph, established a Git workflow, and verified the workspace. This workspace becomes the foundation upon which every microservice, shared package, and infrastructure component will be implemented.

---

# Next Chapter

**Filename:** `V3-C03-Shared-Libraries-And-Dependency-Boundaries.md`

**Chapter 3 — Shared Libraries, Dependency Boundaries & Package Architecture**

The next chapter will design the internal architecture of the shared libraries. We will define what belongs in each package (`common`, `database`, `grpc`, `rabbitmq`, `redis`, `logging`, `tracing`, etc.), enforce dependency boundaries, configure Nx tags and lint rules, and establish how applications interact with shared code without creating tight coupling.

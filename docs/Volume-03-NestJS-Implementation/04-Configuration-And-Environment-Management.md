# Filename

**`V3-C04-Configuration-And-Environment-Management.md`**

---

# Volume 3 — NestJS Microservices Architecture

# Chapter 4 — Configuration, Environment Variables & Secrets Management

**Document:** Distributed Task Scheduler Platform

**Volume:** 3 — NestJS Microservices Architecture

**Chapter:** 4

**Filename:** `V3-C04-Configuration-And-Environment-Management.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Configuration Matters
3. Configuration Architecture
4. Configuration Sources
5. NestJS ConfigModule
6. Typed Configuration
7. Environment Validation
8. Configuration Modules
9. Service-Specific Configuration
10. Secrets Management
11. Runtime Configuration
12. Configuration Caching
13. Docker Integration
14. Kubernetes Integration
15. Local Development
16. Testing Configuration
17. Production Strategy
18. Best Practices
19. Chapter Summary

---

# 4.1 Introduction

Every service in our scheduler needs configuration.

Examples:

- PostgreSQL connection
- RabbitMQ URL
- Redis host
- gRPC ports
- JWT secret
- API Gateway port
- Worker concurrency
- OpenTelemetry endpoint
- Logging level

A common beginner mistake is to access environment variables directly throughout the code.

Example:

```typescript
process.env.DB_HOST;
```

Eventually:

```text
100 Files

↓

process.env

↓

Impossible to Maintain
```

Instead, NestJS provides a centralized configuration system.

---

# 4.2 Why Configuration Matters

Imagine the Worker Service.

It needs:

```text
Database

RabbitMQ

Redis

OpenTelemetry

Logging

Retry Policy

Worker Settings
```

If every class reads environment variables directly:

```text
Controller

↓

process.env
```

```text
Service

↓

process.env
```

```text
Repository

↓

process.env
```

Every layer becomes tightly coupled to environment variables.

Instead:

```text
Environment

↓

ConfigModule

↓

ConfigService

↓

Dependency Injection

↓

Application
```

Only one component knows where configuration comes from.

---

# 4.3 Configuration Architecture

```text
.env

↓

ConfigModule

↓

Validation

↓

Typed Configuration

↓

Dependency Injection

↓

Services
```

Every service receives strongly typed configuration.

Nobody reads environment variables directly.

---

# 4.4 Configuration Sources

Our platform has multiple configuration sources.

Priority (highest first):

```text
Runtime Database Configuration

↓

Environment Variables

↓

.env File

↓

Application Defaults
```

Example:

```text
Worker Concurrency

↓

Database Override

↓

50
```

If no runtime override exists:

```text
Environment Variable

↓

25
```

If nothing exists:

```text
Application Default

↓

10
```

---

# 4.5 NestJS ConfigModule

Every application imports one global module.

```typescript
ConfigModule.forRoot({
  isGlobal: true,
});
```

Benefits:

- One initialization
- Dependency Injection
- Environment loading
- Validation
- Typed configuration

Every module can inject:

```typescript
ConfigService;
```

---

# 4.6 Project Structure

Configuration lives inside every application.

Example:

```text
apps/

worker-service/

src/

config/

├── app.config.ts

├── database.config.ts

├── redis.config.ts

├── rabbitmq.config.ts

├── grpc.config.ts

├── telemetry.config.ts

├── validation.ts

└── index.ts
```

Shared configuration helpers belong in:

```text
packages/common/config/
```

---

# 4.7 Typed Configuration

Instead of:

```typescript
configService.get('PORT');
```

Use typed configuration.

Example:

```typescript
interface DatabaseConfig {
  host: string;

  port: number;

  username: string;

  password: string;

  database: string;
}
```

Now:

```typescript
databaseConfig.port;
```

is a number.

No casting required.

---

# 4.8 Environment Validation

Configuration should fail immediately if invalid.

Bad:

```text
Application Starts

↓

Missing JWT Secret

↓

Crash Later
```

Good:

```text
Application Starts

↓

Validate Config

↓

Error

↓

Exit Immediately
```

Startup should never continue with invalid configuration.

---

# 4.9 Validation with Zod

We use **Zod** for schema validation.

Example:

```typescript
const ConfigSchema = z.object({
  PORT: z.number(),

  DB_HOST: z.string(),

  DB_PORT: z.number(),

  REDIS_HOST: z.string(),

  JWT_SECRET: z.string().min(32),
});
```

During startup:

```text
Environment

↓

Zod Validation

↓

Valid?

↓

YES

↓

Application Starts
```

Otherwise:

```text
Exit Process
```

---

# 4.10 Service-Specific Configuration

Every service has unique settings.

---

### API Gateway

```text
HTTP Port

Rate Limit

JWT

CORS
```

---

### Scheduler

```text
Scanner Interval

Bucket Size

Dispatch Batch

Lease Duration
```

---

### Worker

```text
Concurrency

Retry Limit

Execution Timeout

Heartbeat Interval
```

---

### Notification

```text
SMTP

SES

Twilio

Webhook Timeout
```

Configuration remains isolated.

---

# 4.11 Secrets Management

Never commit secrets.

Never.

Bad:

```typescript
JWT_SECRET = 'mysecret';
```

inside Git.

Instead:

```text
Development

↓

.env.local
```

Production:

```text
Kubernetes Secret
```

Future:

```text
HashiCorp Vault

AWS Secrets Manager

Azure Key Vault

Google Secret Manager
```

---

# 4.12 Runtime Configuration

Not everything belongs in environment variables.

Examples:

```text
Retry Count

Worker Concurrency

Scanner Batch Size

Feature Flags
```

These live inside PostgreSQL.

Workflow:

```text
Application

↓

Config Service

↓

Redis Cache

↓

Database
```

Runtime configuration changes without restarting services.

---

# 4.13 Configuration Caching

Every request should not hit PostgreSQL.

Instead:

```text
Database

↓

Redis

↓

Application
```

Example:

```text
Retry Policy

↓

Redis

↓

TTL 60 Seconds
```

Configuration updates publish:

```text
ConfigurationChanged Event
```

All services refresh.

---

# 4.14 Docker Integration

Development:

```text
docker-compose.yml

↓

Environment Variables

↓

Containers
```

Worker example:

```yaml
environment:
  DB_HOST: postgres

  REDIS_HOST: redis

  RABBITMQ_HOST: rabbitmq
```

Containers communicate through Docker networking.

---

# 4.15 Kubernetes Integration

Production:

```text
ConfigMap

↓

Non-secret Config
```

Secrets:

```text
Secret

↓

JWT

Database Password

RabbitMQ Password
```

Deployment:

```text
Pod

↓

Environment Variables

↓

NestJS
```

No secrets exist inside Docker images.

---

# 4.16 Local Development

Recommended files:

```text
.env

.env.local

.env.development

.env.test

.env.production
```

Git ignores:

```text
.env.local
```

Each developer keeps personal overrides.

---

# 4.17 Configuration Example

Worker:

```text
WorkerConfig

├── concurrency

├── heartbeat

├── timeout

├── retry

├── leaseDuration
```

RabbitMQ:

```text
RabbitConfig

├── host

├── port

├── exchange

├── prefetch

├── reconnect
```

Redis:

```text
RedisConfig

├── host

├── port

├── database

├── password

├── ttl
```

---

# 4.18 Configuration Loading Flow

```text
Application Starts

↓

Load .env

↓

Merge Environment

↓

Validate

↓

Create Config Objects

↓

Dependency Injection

↓

Application Ready
```

No service accesses raw environment variables.

---

# 4.19 Recommended Configuration Modules

Shared package:

```text
packages/common/config/

├── app.config.ts

├── database.config.ts

├── redis.config.ts

├── rabbitmq.config.ts

├── grpc.config.ts

├── telemetry.config.ts

├── logger.config.ts

├── auth.config.ts

├── scheduler.config.ts

└── validation.ts
```

Every application imports only what it needs.

---

# 4.20 Complete Configuration Architecture

```text
                    Environment

                           │

         ┌─────────────────┴──────────────────┐

         ▼                                    ▼

     .env Files                      Kubernetes Secrets

         │                                    │

         └─────────────────┬──────────────────┘

                           ▼

                    ConfigModule

                           ▼

                  Validation (Zod)

                           ▼

                 Typed Configuration

                           ▼

                  Dependency Injection

                           ▼

        API Gateway  Scheduler  Worker  Notification
```

This architecture keeps configuration centralized, validated, and secure.

---

# 4.21 Best Practices

- Never access `process.env` outside configuration modules.
- Use `ConfigModule` as a global module.
- Validate all configuration at startup.
- Use typed configuration objects.
- Keep secrets out of Git.
- Separate runtime configuration from environment configuration.
- Cache runtime configuration in Redis.
- Store operational settings in PostgreSQL.
- Keep service-specific configuration isolated.
- Fail fast if configuration is invalid.

---

# Chapter Summary

This chapter designed the complete configuration architecture for the scheduler platform. We centralized environment management using NestJS `ConfigModule`, introduced typed configuration, validated settings with Zod, separated environment variables from runtime configuration, integrated Docker and Kubernetes secrets, and established a secure configuration strategy suitable for development and production. Every service now has a consistent, maintainable, and strongly typed configuration system.

---

# Next Chapter

**Filename:** `V3-C05-TypeORM-Integration-And-Database-Module.md`

**Chapter 5 — Building the Shared Database Module with TypeORM**

In the next chapter we will implement the shared database infrastructure. We will configure TypeORM, define the `DataSource`, create reusable repositories, manage migrations, transactions, entity registration, connection pooling, health checks, and integrate PostgreSQL with every NestJS microservice through a centralized `DatabaseModule`.

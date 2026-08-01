# Filename

**`V2-C15-Identity-And-Multi-Tenant-Storage.md`**

---

# Volume 2 — Database Design

# Chapter 15 — Identity, Authentication & Multi-Tenant Storage

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 15

**Filename:** `V2-C15-Identity-And-Multi-Tenant-Storage.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Identity Needs Its Own Schema
3. Identity Architecture
4. Multi-Tenant Design
5. Tenant Table
6. Users Table
7. Roles & Permissions
8. Service Accounts
9. API Keys
10. Refresh Tokens
11. Sessions
12. OAuth Clients
13. Tenant Isolation
14. Query Patterns
15. Constraints & Indexes
16. Complete SQL
17. Future Evolution
18. Best Practices
19. Chapter Summary

---

# 15.1 Introduction

Our scheduler is not a simple cron application.

It is designed as a **multi-tenant distributed platform** where multiple organizations can use the same infrastructure while remaining completely isolated.

Example:

```text
Cloud Scheduler

        │
        │
        ├──────────────┐
        │              │
        ▼              ▼

Tenant A         Tenant B

Acme Corp        Globex Inc.

Users            Users

Jobs             Jobs

Workers          Workers

Schedules        Schedules
```

Each tenant should believe they are using their own scheduler, even though the infrastructure is shared.

This requires a dedicated Identity schema.

---

# 15.2 Why Identity Needs Its Own Schema

A beginner might store:

```text
users
```

inside:

```text
scheduler
```

This becomes problematic because identity is shared across every subsystem:

- Scheduler
- Notifications
- Audit
- API Gateway
- Admin Portal
- Worker Dashboard
- Billing

Instead:

```text
identity

├── tenants
├── users
├── roles
├── permissions
├── api_keys
├── service_accounts
├── refresh_tokens
├── oauth_clients
└── sessions
```

Identity becomes an independent domain.

---

# 15.3 Identity Architecture

```text
Client

↓

API Gateway

↓

Identity Service

↓

PostgreSQL

↓

JWT

↓

Scheduler

↓

Notification

↓

Audit
```

The Identity Service authenticates requests.

Other services authorize based on JWT claims.

---

# 15.4 Multi-Tenant Model

Every business object belongs to a tenant.

```text
Tenant

↓

Users

↓

Schedules

↓

Jobs

↓

Notifications

↓

Audit Logs
```

Relationship:

```text
tenants

   │

   │ 1

   ▼

users

   │

   │ N

   ▼

jobs
```

Tenant ownership is enforced everywhere.

---

# 15.5 Tenants Table

Table:

```text
identity.tenants
```

Purpose:

Represents one organization.

---

## Columns

| Column         | Type              |
| -------------- | ----------------- |
| id             | UUID              |
| name           | VARCHAR(255)      |
| slug           | VARCHAR(100)      |
| status         | tenant_status     |
| plan           | subscription_plan |
| timezone       | VARCHAR(100)      |
| default_locale | VARCHAR(20)       |
| created_at     | TIMESTAMPTZ       |
| updated_at     | TIMESTAMPTZ       |

---

## Example

```text
Tenant

↓

Acme Corporation

↓

Premium Plan

↓

Asia/Kolkata
```

---

# 15.6 Users Table

Table:

```text
identity.users
```

Users belong to exactly one tenant.

---

## Columns

| Column        | Type         |
| ------------- | ------------ |
| id            | UUID         |
| tenant_id     | UUID         |
| email         | VARCHAR(255) |
| password_hash | TEXT         |
| full_name     | VARCHAR(255) |
| status        | user_status  |
| last_login_at | TIMESTAMPTZ  |
| created_at    | TIMESTAMPTZ  |

---

Passwords are **never encrypted**.

They are **hashed** using Argon2 or bcrypt.

---

# 15.7 Roles

Rather than assigning permissions directly:

```text
User

↓

Permission
```

We use RBAC.

```text
User

↓

Role

↓

Permissions
```

Table:

```text
identity.roles
```

---

## Columns

| Column      | Type    |
| ----------- | ------- |
| id          | UUID    |
| tenant_id   | UUID    |
| role_name   | VARCHAR |
| description | TEXT    |

---

Examples:

```text
Admin

Operator

Viewer

Developer

Billing
```

---

# 15.8 Permissions

Table:

```text
identity.permissions
```

---

Examples:

```text
scheduler.read

scheduler.write

scheduler.delete

notification.send

tenant.manage

audit.read
```

---

Many-to-many relationship:

```text
roles

    │

    ▼

role_permissions

    ▲

permissions
```

---

# 15.9 Service Accounts

Not every caller is a human.

Examples:

- Scheduler Service
- Notification Service
- Analytics Service
- Billing Service

Table:

```text
identity.service_accounts
```

---

## Columns

| Column             | Type    |
| ------------------ | ------- |
| id                 | UUID    |
| tenant_id          | UUID    |
| name               | VARCHAR |
| client_id          | VARCHAR |
| client_secret_hash | TEXT    |
| enabled            | BOOLEAN |

---

Service accounts authenticate microservices.

---

# 15.10 API Keys

External integrations may use API keys.

Table:

```text
identity.api_keys
```

---

## Columns

| Column       | Type        |
| ------------ | ----------- |
| id           | UUID        |
| tenant_id    | UUID        |
| key_hash     | TEXT        |
| name         | VARCHAR     |
| scopes       | JSONB       |
| expires_at   | TIMESTAMPTZ |
| last_used_at | TIMESTAMPTZ |
| created_at   | TIMESTAMPTZ |

---

Store only hashes.

Never store plaintext API keys.

---

# 15.11 Refresh Tokens

JWT access tokens are short-lived.

Refresh tokens obtain new access tokens.

Table:

```text
identity.refresh_tokens
```

---

## Columns

| Column     | Type        |
| ---------- | ----------- |
| id         | UUID        |
| user_id    | UUID        |
| token_hash | TEXT        |
| expires_at | TIMESTAMPTZ |
| revoked    | BOOLEAN     |
| created_at | TIMESTAMPTZ |

---

Compromised refresh tokens can be revoked without affecting other sessions.

---

# 15.12 Sessions

Table:

```text
identity.sessions
```

Purpose:

Track active logins.

---

## Columns

| Column     | Type        |
| ---------- | ----------- |
| id         | UUID        |
| user_id    | UUID        |
| ip_address | INET        |
| user_agent | TEXT        |
| started_at | TIMESTAMPTZ |
| expires_at | TIMESTAMPTZ |
| revoked    | BOOLEAN     |

---

Supports:

- Logout
- Force logout
- Device management

---

# 15.13 OAuth Clients

Future integrations may support OAuth2.

Table:

```text
identity.oauth_clients
```

---

## Columns

| Column             | Type    |
| ------------------ | ------- |
| id                 | UUID    |
| client_id          | VARCHAR |
| client_secret_hash | TEXT    |
| redirect_uri       | TEXT    |
| scopes             | JSONB   |
| enabled            | BOOLEAN |

---

Allows third-party applications to integrate securely.

---

# 15.14 Tenant Isolation

Every operational table contains:

```text
tenant_id
```

Example:

```text
jobs

↓

tenant_id
```

Worker queries:

```sql
SELECT *
FROM scheduler.jobs
WHERE tenant_id = $1;
```

No tenant can access another tenant's data.

---

# 15.15 Relationship Diagram

```text
tenants

   │

   ├─────────────┐

   ▼             ▼

users         api_keys

   │

   ▼

roles

   │

   ▼

permissions
```

Every identity object belongs to a tenant.

---

# 15.16 Query Patterns

User lookup:

```sql
SELECT *
FROM identity.users
WHERE email=$1;
```

Tenant users:

```sql
SELECT *
FROM identity.users
WHERE tenant_id=$1;
```

API keys:

```sql
SELECT *
FROM identity.api_keys
WHERE expires_at > NOW();
```

Refresh tokens:

```sql
SELECT *
FROM identity.refresh_tokens
WHERE revoked=FALSE;
```

Role permissions:

```sql
SELECT *
FROM identity.role_permissions
WHERE role_id=$1;
```

---

# 15.17 Constraints

Tenants

```sql
PRIMARY KEY(id)
```

Users

```sql
FOREIGN KEY(tenant_id)
REFERENCES identity.tenants(id)
```

Unique:

```sql
UNIQUE(email)
```

API Keys

```sql
UNIQUE(key_hash)
```

Roles

```sql
UNIQUE(tenant_id, role_name)
```

Refresh Tokens

```sql
CHECK(expires_at > created_at)
```

---

# 15.18 Index Strategy

Tenants:

```text
(slug)
```

Users:

```text
(email)
```

```text
(tenant_id)
```

API Keys:

```text
(key_hash)
```

Refresh Tokens:

```text
(user_id)
```

Sessions:

```text
(user_id)
```

Composite:

```text
(tenant_id, email)
```

Composite:

```text
(tenant_id, role_name)
```

---

# 15.19 Initial SQL Definition

## tenants

```sql
CREATE TABLE identity.tenants (

    id UUID PRIMARY KEY,

    name VARCHAR(255),

    slug VARCHAR(100) UNIQUE,

    status tenant_status,

    plan subscription_plan,

    timezone VARCHAR(100),

    default_locale VARCHAR(20),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## users

```sql
CREATE TABLE identity.users (

    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL
        REFERENCES identity.tenants(id),

    email VARCHAR(255) UNIQUE,

    password_hash TEXT,

    full_name VARCHAR(255),

    status user_status,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## api_keys

```sql
CREATE TABLE identity.api_keys (

    id UUID PRIMARY KEY,

    tenant_id UUID
        REFERENCES identity.tenants(id),

    key_hash TEXT UNIQUE,

    name VARCHAR(255),

    scopes JSONB,

    expires_at TIMESTAMPTZ,

    last_used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## refresh_tokens

```sql
CREATE TABLE identity.refresh_tokens (

    id UUID PRIMARY KEY,

    user_id UUID
        REFERENCES identity.users(id),

    token_hash TEXT,

    expires_at TIMESTAMPTZ,

    revoked BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 15.20 Authentication Flow

```text
User

↓

Login

↓

Identity Service

↓

Validate Password

↓

Generate JWT

↓

Generate Refresh Token

↓

Store Session

↓

Client Receives Tokens

↓

Access Scheduler APIs
```

Every service validates the JWT locally using the public key.

No database lookup is required for every request.

---

# 15.21 Authorization Flow

```text
JWT

↓

Tenant ID

↓

Roles

↓

Permissions

↓

Endpoint

↓

Access Granted
```

Example:

```text
scheduler.jobs.create
```

If the permission is missing:

```text
403 Forbidden
```

The Scheduler never checks passwords directly.

It trusts the Identity Service.

---

# 15.22 Future Evolution

```text
Users

↓

RBAC

↓

Service Accounts

↓

OAuth2

↓

OIDC

↓

SSO

↓

SAML

↓

SCIM

↓

Enterprise Identity Platform
```

Large enterprise customers can later integrate with:

- Azure AD
- Okta
- Auth0
- Google Workspace
- Keycloak

without redesigning the database.

---

# 15.23 Best Practices

- Keep identity in its own schema.
- Hash passwords and API keys.
- Never store plaintext secrets.
- Use RBAC instead of direct permissions.
- Store `tenant_id` on every business entity.
- Validate JWTs locally.
- Keep refresh tokens revocable.
- Record active sessions.
- Separate human users from service accounts.
- Design for enterprise SSO from the beginning.

---

# Chapter Summary

This chapter designed the complete **Identity and Multi-Tenant** storage model for the distributed scheduler platform. We created schemas for tenants, users, roles, permissions, service accounts, API keys, refresh tokens, sessions, and OAuth clients. We explored RBAC, JWT authentication, tenant isolation, authorization flow, indexing strategies, SQL definitions, and enterprise-ready identity architecture. This schema provides secure authentication, fine-grained authorization, and complete tenant isolation while supporting future integrations with enterprise identity providers.

---

# Next Chapter

**Filename:** `V2-C16-Monitoring-Metrics-And-System-Health.md`

**Chapter 16 — Monitoring, Metrics & System Health Storage**

The next chapter will design the observability database for the platform, including system metrics, worker heartbeats, scheduler lag, queue depth snapshots, scanner performance, dispatcher metrics, Prometheus integration, health checks, alert thresholds, and historical performance analytics.

# Chapter 8 — REST API Design

**Document:** Distributed Task Scheduler Platform
**Chapter:** 8
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. REST Design Principles
3. API Versioning
4. Authentication & Authorization
5. Resource Model
6. Standard Request Lifecycle
7. API Endpoints
8. Request Validation
9. Response Structure
10. Error Handling
11. HTTP Status Codes
12. Idempotency
13. Pagination
14. Filtering & Sorting
15. Rate Limiting
16. API Documentation
17. API Best Practices
18. Chapter Summary

---

# 8.1 Introduction

The REST API is the public entry point into the Distributed Task Scheduler Platform.

Clients such as web applications, mobile applications, backend services, and third-party integrations interact with the scheduler exclusively through this API.

The API is responsible for:

- Accepting scheduling requests
- Validating input
- Authenticating clients
- Returning standardized responses
- Forwarding valid requests to internal services using gRPC

The API **does not** execute business logic or directly access the database.

---

# 8.2 REST Design Principles

The API follows standard REST architectural principles.

## Resource-Oriented Design

Everything is treated as a resource.

Examples:

```text
/jobs

/schedules

/health
```

---

## Stateless Requests

Each request contains all information required to process it.

The server does not store client session state.

---

## Standard HTTP Methods

| Method | Purpose |
| ------ | ------- |
| GET    | Read    |
| POST   | Create  |
| PUT    | Replace |
| PATCH  | Update  |
| DELETE | Remove  |

---

## Consistent Naming

Use nouns instead of verbs.

Good

```text
/jobs
```

Bad

```text
/createJob
```

---

# 8.3 API Versioning

Version APIs through the URL.

Example

```text
/api/v1/jobs
```

Future versions

```text
/api/v2/jobs
```

Benefits:

- Backward compatibility
- Controlled migrations
- Independent client upgrades

---

# 8.4 Authentication & Authorization

Clients authenticate using JWT.

Example

```http
Authorization: Bearer <JWT_TOKEN>
```

After authentication, the API extracts:

- User ID
- Tenant ID
- Roles
- Permissions

Authorization determines whether the client is allowed to perform the requested operation.

Examples:

- Create jobs
- Delete jobs
- Read schedules
- View audit history

---

# 8.5 Resource Model

The API exposes the following resources.

| Resource  | Description              |
| --------- | ------------------------ |
| Jobs      | One-time scheduled tasks |
| Schedules | Recurring schedules      |
| Audit     | Execution history        |
| Health    | Service status           |
| Metrics   | Monitoring endpoints     |

---

# 8.6 Standard Request Lifecycle

Every request follows the same flow.

```text
Client

↓

Load Balancer

↓

REST API

↓

Authentication

↓

Validation

↓

Authorization

↓

Logging

↓

Tracing

↓

gRPC

↓

Timer Service

↓

Response
```

Each stage is implemented as middleware, guards, interceptors, or pipes in NestJS.

---

# 8.7 API Endpoints

## Create Job

```http
POST /api/v1/jobs
```

### Request

```json
{
  "handler": "send-email",
  "executeAt": "2027-01-01T10:00:00Z",
  "payload": {
    "email": "user@example.com"
  },
  "retryPolicy": {
    "maxRetries": 5,
    "strategy": "EXPONENTIAL"
  }
}
```

### Response

```json
{
  "jobId": "job_12345",
  "status": "READY",
  "createdAt": "2027-01-01T08:30:00Z"
}
```

---

## Get Job

```http
GET /api/v1/jobs/{jobId}
```

---

## Update Job

```http
PATCH /api/v1/jobs/{jobId}
```

Allows updating:

- execution time
- payload
- priority
- retry policy

Only jobs in the `READY` state may be modified.

---

## Cancel Job

```http
DELETE /api/v1/jobs/{jobId}
```

Response

```json
{
  "status": "CANCELLED"
}
```

---

## List Jobs

```http
GET /api/v1/jobs
```

Supports:

- pagination
- filtering
- sorting

---

## Create Schedule

```http
POST /api/v1/schedules
```

Example

```json
{
  "cron": "0 9 * * *",
  "timezone": "UTC",
  "handler": "daily-report"
}
```

---

## Pause Schedule

```http
POST /api/v1/schedules/{id}/pause
```

---

## Resume Schedule

```http
POST /api/v1/schedules/{id}/resume
```

---

## Delete Schedule

```http
DELETE /api/v1/schedules/{id}
```

---

## Health Check

```http
GET /health
```

---

# 8.8 Request Validation

Every incoming request is validated before processing.

Validation includes:

- Required fields
- Data types
- Date formats
- Enum values
- Maximum payload size
- Business rules

Example

```json
{
  "executeAt": "invalid-date"
}
```

Response

```json
{
  "error": "Invalid execution time."
}
```

NestJS Validation Pipes perform request validation automatically.

---

# 8.9 Response Structure

Every successful response follows a consistent structure.

```json
{
  "success": true,
  "data": {},
  "metadata": {}
}
```

Example

```json
{
  "success": true,
  "data": {
    "jobId": "job123",
    "status": "READY"
  }
}
```

---

# 8.10 Error Handling

Errors follow a standardized format.

Example

```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "The requested job does not exist."
  }
}
```

Advantages:

- Predictable client behavior
- Easier debugging
- Consistent documentation

---

# 8.11 HTTP Status Codes

| Status | Meaning                 |
| ------ | ----------------------- |
| 200    | Success                 |
| 201    | Resource created        |
| 202    | Accepted for processing |
| 204    | No content              |
| 400    | Bad request             |
| 401    | Unauthorized            |
| 403    | Forbidden               |
| 404    | Resource not found      |
| 409    | Conflict                |
| 422    | Validation failed       |
| 429    | Rate limit exceeded     |
| 500    | Internal server error   |
| 503    | Service unavailable     |

Each endpoint returns the most appropriate status code.

---

# 8.12 Idempotency

Network failures may cause clients to retry requests.

Without idempotency:

```text
POST /jobs

↓

Network timeout

↓

Client retries

↓

Two jobs created
```

To prevent duplicate job creation, clients send an idempotency key.

Example

```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

The server stores the key and returns the original response for repeated requests using the same key.

---

# 8.13 Pagination

Large result sets should never be returned in a single response.

Example

```http
GET /jobs?page=2&limit=50
```

Example response

```json
{
  "data": [],
  "metadata": {
    "page": 2,
    "limit": 50,
    "total": 1240
  }
}
```

---

# 8.14 Filtering & Sorting

Clients may filter resources.

Example

```http
GET /jobs?status=READY
```

Multiple filters

```http
GET /jobs?status=READY&priority=HIGH
```

Sorting

```http
GET /jobs?sort=executeAt
```

Descending

```http
GET /jobs?sort=-executeAt
```

---

# 8.15 Rate Limiting

The API protects itself from abuse using rate limiting.

Example policy:

```text
100 requests/minute/user
```

If exceeded:

```http
429 Too Many Requests
```

Rate limiting is enforced using Redis.

---

# 8.16 API Documentation

The API is documented using OpenAPI (Swagger).

Documentation includes:

- Endpoints
- Parameters
- Request bodies
- Responses
- Authentication
- Error codes
- Examples

Benefits:

- Interactive testing
- SDK generation
- Easier client integration

---

# 8.17 API Best Practices

The API follows these guidelines:

- Use plural resource names (`/jobs`)
- Keep URLs noun-based
- Return consistent JSON structures
- Use appropriate HTTP status codes
- Validate all input
- Support idempotency for create operations
- Use pagination for collections
- Avoid breaking changes within a version
- Log every request with a trace ID
- Document all endpoints with OpenAPI

---

# 8.18 Endpoint Summary

| Endpoint                      | Purpose                   |
| ----------------------------- | ------------------------- |
| `POST /jobs`                  | Create job                |
| `GET /jobs/{id}`              | Retrieve job              |
| `PATCH /jobs/{id}`            | Update waiting job        |
| `DELETE /jobs/{id}`           | Cancel job                |
| `GET /jobs`                   | List jobs                 |
| `POST /schedules`             | Create recurring schedule |
| `POST /schedules/{id}/pause`  | Pause schedule            |
| `POST /schedules/{id}/resume` | Resume schedule           |
| `DELETE /schedules/{id}`      | Delete schedule           |
| `GET /health`                 | Health check              |

---

# Chapter Summary

This chapter designed the public REST API for the Distributed Task Scheduler Platform. We established REST design principles, API versioning, authentication and authorization, resource modeling, request validation, standardized response formats, error handling, HTTP status codes, idempotency support, pagination, filtering, rate limiting, and API documentation. These conventions ensure that the scheduler exposes a predictable, secure, and developer-friendly interface while delegating business logic to the internal microservices.

---

# Next Chapter

**Chapter 9 — gRPC Design & Protocol Buffers**

The next chapter moves from the external API to the internal communication layer. It will define Protocol Buffer schemas, gRPC service contracts, request and response messages, streaming patterns, error handling, versioning, deadlines, retries, interceptors, and how NestJS microservices communicate efficiently within the scheduler.

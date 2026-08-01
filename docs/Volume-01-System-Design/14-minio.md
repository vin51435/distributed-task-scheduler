# Chapter 14 — Object Storage Design (MinIO)

**Document:** Distributed Task Scheduler Platform
**Chapter:** 14
**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Object Storage?
3. Why MinIO?
4. Object Storage Responsibilities
5. Storage Architecture
6. Bucket Organization
7. Stored Objects
8. Object Lifecycle
9. Upload & Download Flow
10. Security
11. Versioning
12. Lifecycle Policies
13. Backup Strategy
14. High Availability
15. Migration to Cloud Storage
16. Best Practices
17. Chapter Summary

---

# 14.1 Introduction

Not all data belongs in a relational database.

Large files, exported reports, backups, archived logs, and other binary objects are better suited for **Object Storage**.

The scheduler uses **MinIO** during development and self-hosted deployments because it provides an API compatible with Amazon S3.

In cloud environments, MinIO can later be replaced with:

- Amazon S3
- Google Cloud Storage
- Azure Blob Storage

without changing application logic.

---

# 14.2 Why Object Storage?

PostgreSQL is optimized for structured data.

It is not designed for storing:

- Large files
- Backups
- Binary objects
- Log archives
- Reports

Object storage is optimized for exactly these use cases.

Advantages include:

- Virtually unlimited capacity
- Low cost
- High durability
- Easy backup
- Simple HTTP access

---

# 14.3 Why MinIO?

MinIO was selected because it provides:

- S3-compatible APIs
- Self-hosting
- Docker support
- Kubernetes support
- High performance
- Open source licensing

Development becomes identical to production because the application communicates through the S3 API regardless of the storage provider.

---

# 14.4 Object Storage Responsibilities

Object storage is **not** responsible for scheduling.

It stores large, infrequently modified objects.

Examples include:

- PostgreSQL backups
- Exported audit reports
- Archived execution logs
- Diagnostic bundles
- Large job attachments (future)
- System snapshots

Business metadata remains inside PostgreSQL.

---

# 14.5 Storage Architecture

```text
                 Scheduler

                     │

         ┌───────────┼───────────┐

         │                       │

    PostgreSQL              MinIO

 Structured Data        Binary Objects
```

The Timer Service stores metadata in PostgreSQL while binary assets reside in MinIO.

---

# 14.6 Bucket Organization

Separate buckets improve security and lifecycle management.

Example:

```text
scheduler-backups/

scheduler-audit/

scheduler-exports/

scheduler-logs/

scheduler-attachments/
```

Each bucket has its own:

- Permissions
- Lifecycle policy
- Retention period

---

# 14.7 Stored Objects

## Database Backups

Example:

```text
backups/

2027/

01/

backup-2027-01-01.sql.gz
```

---

## Audit Exports

Generated reports.

Example:

```text
audit/

tenant-001/

audit-report.pdf
```

---

## Execution Logs

Archived worker logs.

```text
logs/

worker-12/

2027/

01/

execution.log.gz
```

---

## Future Attachments

Large payloads should not travel through RabbitMQ.

Instead:

```text
Client

↓

Upload File

↓

MinIO

↓

Object Key

↓

Store Key in PostgreSQL
```

Workers later retrieve the object using the stored key.

---

# 14.8 Object Lifecycle

Example upload flow:

```text
Generate Report

↓

Store Object

↓

Receive Object Key

↓

Store Metadata

↓

Return URL
```

Deletion follows:

```text
Object

↓

Retention Expires

↓

Lifecycle Policy

↓

Automatic Removal
```

---

# 14.9 Upload & Download Flow

## Upload

```text
Service

↓

Generate Object Name

↓

Upload

↓

Receive ETag

↓

Save Metadata
```

---

## Download

```text
Client

↓

API

↓

Temporary Signed URL

↓

MinIO

↓

Object
```

Objects are never exposed directly without authorization.

---

# 14.10 Object Naming Strategy

Object names should be deterministic.

Example:

```text
backups/

2027/

01/

01/

postgres-backup.sql.gz
```

Audit report:

```text
audit/

tenant-001/

2027/

report-001.pdf
```

Naming conventions should include:

- Resource type
- Tenant
- Date
- Identifier

This improves discoverability.

---

# 14.11 Security

Access is controlled through credentials.

Example:

```text
API

↓

Authenticate User

↓

Authorize Request

↓

Generate Signed URL

↓

Access Object
```

Objects remain private.

Only authenticated services or users receive temporary access.

---

## Encryption

Object storage should support:

- Encryption at rest
- Encryption in transit (TLS)

Sensitive backups should be encrypted before upload.

---

# 14.12 Versioning

Versioning prevents accidental overwrites.

Example:

```text
backup.sql

↓

Version 1

↓

Version 2

↓

Version 3
```

Benefits:

- Recovery
- Auditability
- Rollback

Development environments may disable versioning to save storage.

Production should enable it.

---

# 14.13 Lifecycle Policies

Not every object should be stored forever.

Example policy:

| Object          | Retention |
| --------------- | --------- |
| Daily backups   | 30 days   |
| Weekly backups  | 6 months  |
| Monthly backups | 1 year    |
| Audit exports   | 90 days   |
| Logs            | 180 days  |

Automatic cleanup prevents unlimited storage growth.

---

# 14.14 Backup Strategy

PostgreSQL backups are periodically uploaded.

```text
PostgreSQL

↓

Backup Script

↓

Compressed Archive

↓

MinIO

↓

Verify Upload
```

Verification should confirm:

- Upload completed
- File checksum matches
- Backup is readable

Unverified backups should never be considered successful.

---

# 14.15 High Availability

Development:

```text
Single MinIO Instance
```

Production:

```text
                MinIO Cluster

         ┌──────────┼──────────┐

         │          │          │

      Node 1     Node 2     Node 3
```

High availability provides:

- Redundancy
- Fault tolerance
- Better throughput

---

# 14.16 Failure Scenarios

## Upload Failure

```text
Service

↓

Upload Failed

↓

Retry

↓

Alert
```

Metadata should not be committed until upload succeeds.

---

## Object Missing

```text
API

↓

Object Not Found

↓

Return Error

↓

Log Incident
```

---

## Storage Full

```text
MinIO

↓

Capacity Threshold

↓

Alert

↓

Provision More Storage
```

Storage utilization should be monitored continuously.

---

# 14.17 Migration to Cloud Storage

Application code communicates through the S3 API.

Development:

```text
Application

↓

MinIO
```

Production:

```text
Application

↓

Amazon S3
```

or

```text
Application

↓

Google Cloud Storage
```

or

```text
Application

↓

Azure Blob Storage
```

Because MinIO is S3-compatible, migration primarily involves updating configuration rather than rewriting business logic.

---

# 14.18 Best Practices

The scheduler follows these principles:

- Store only binary or large objects.
- Keep metadata in PostgreSQL.
- Use separate buckets by purpose.
- Enable TLS.
- Encrypt sensitive backups.
- Generate temporary signed URLs instead of exposing objects publicly.
- Verify every backup after upload.
- Use lifecycle policies to remove obsolete data.
- Monitor storage capacity.
- Prefer immutable objects over overwriting existing files.

---

# 14.19 Storage Summary

| Bucket                  | Purpose                 | Retention    |
| ----------------------- | ----------------------- | ------------ |
| `scheduler-backups`     | PostgreSQL backups      | Configurable |
| `scheduler-audit`       | Audit reports           | 90 days      |
| `scheduler-exports`     | User exports            | Configurable |
| `scheduler-logs`        | Archived logs           | 180 days     |
| `scheduler-attachments` | Large payloads (future) | Configurable |

---

# Chapter Summary

This chapter designed the object storage layer for the Distributed Task Scheduler Platform. We explored why binary objects should be separated from relational data, selected MinIO as an S3-compatible storage solution, defined bucket organization, object lifecycle, upload and download flows, security, versioning, lifecycle policies, backup strategies, and migration to cloud object storage. By isolating large files from PostgreSQL, the scheduler achieves better scalability, lower database overhead, and a storage architecture that can seamlessly evolve from local development to cloud-native deployments.

---

# Next Chapter

**Chapter 15 — Timer Store Architecture & Scheduling Engine**

The next chapter moves from infrastructure into the core scheduling engine itself. It will design how the Timer Service persists and manages scheduled jobs, bucketization strategies, efficient scanner queries, time-wheel concepts, job promotion, state transitions, scheduling algorithms, concurrency control, and the complete lifecycle of a scheduled task from creation until execution.

# Filename

**`V2-C12-Notification-Storage.md`**

---

# Volume 2 — Database Design

# Chapter 12 — Notification Storage Design

**Document:** Distributed Task Scheduler Platform

**Volume:** 2 — Database Design

**Chapter:** 12

**Filename:** `V2-C12-Notification-Storage.md`

**Version:** 1.0

---

# Table of Contents

1. Introduction
2. Why Notifications Need Their Own Database
3. Notification Architecture
4. Notification Lifecycle
5. Notification Domain Model
6. Notification Templates
7. Notification Jobs
8. Delivery Attempts
9. Provider Responses
10. Notification Preferences
11. Channel-Specific Data
12. Query Patterns
13. Constraints & Indexes
14. Complete SQL
15. Future Evolution
16. Best Practices
17. Chapter Summary

---

# 12.1 Introduction

Sending a notification seems simple.

Examples:

- Send Email
- Send SMS
- Push Notification
- Slack Message
- Discord Webhook
- Microsoft Teams
- WhatsApp Message
- Mobile Push
- Webhook Callback

However, production notification systems must answer questions like:

- Was it delivered?
- Which provider handled it?
- How long did delivery take?
- Was it retried?
- What response did the provider return?
- Which template generated it?
- Was it opened?
- Did the user unsubscribe?

These concerns are completely different from scheduling.

Therefore, notifications require their own storage model.

---

# 12.2 Why Notifications Need Their Own Database

A common mistake:

```text
jobs

↓

Send Email

↓

Status = COMPLETED
```

After completion we know nothing about:

- SMTP response
- Delivery
- Bounce
- Spam rejection
- Retry
- Open rate

Instead:

```text
Scheduler

↓

Notification Service

↓

Notification Database

↓

Provider
```

The scheduler only executes the notification job.

The Notification Service owns delivery tracking.

---

# 12.3 Notification Architecture

```text
Scheduler

↓

RabbitMQ

↓

Notification Worker

↓

notification_templates

↓

notifications

↓

delivery_attempts

↓

Email Provider
```

Each table has one responsibility.

---

# 12.4 Notification Lifecycle

```text
Template

↓

Notification Created

↓

Waiting

↓

Sending

↓

Delivered
```

Failure path:

```text
Sending

↓

Failed

↓

Retry

↓

Failed

↓

DLQ
```

Every delivery attempt is preserved.

---

# 12.5 Domain Model

The notification subsystem consists of multiple entities.

```text
notification_templates

        │

        ▼

notifications

        │

        ▼

delivery_attempts

        │

        ▼

provider_responses
```

Additional supporting tables:

```text
notification_preferences

notification_channels

notification_events
```

---

# 12.6 Notification Templates

Templates define reusable content.

Table:

```text
notification.notification_templates
```

---

## Purpose

Stores:

- Subject
- Body
- Variables
- Channel
- Version
- Locale

---

## Columns

| Column     | Type                 |
| ---------- | -------------------- |
| id         | UUID                 |
| name       | VARCHAR              |
| channel    | notification_channel |
| subject    | TEXT                 |
| body       | TEXT                 |
| variables  | JSONB                |
| locale     | VARCHAR(10)          |
| version    | INTEGER              |
| is_active  | BOOLEAN              |
| created_at | TIMESTAMPTZ          |

---

## Example

Subject:

```text
Invoice #{invoiceNumber}
```

Body:

```text
Hello {{customerName}}

Your invoice is attached.
```

Variables:

```json
{
  "customerName": "John",
  "invoiceNumber": "INV-1024"
}
```

---

# 12.7 Notifications Table

Represents one logical notification.

Table:

```text
notification.notifications
```

---

## Columns

| Column       | Type                 |
| ------------ | -------------------- |
| id           | UUID                 |
| tenant_id    | UUID                 |
| job_id       | UUID                 |
| template_id  | UUID                 |
| recipient    | VARCHAR              |
| channel      | notification_channel |
| status       | notification_status  |
| payload      | JSONB                |
| scheduled_at | TIMESTAMPTZ          |
| sent_at      | TIMESTAMPTZ          |
| delivered_at | TIMESTAMPTZ          |
| created_at   | TIMESTAMPTZ          |

---

One notification may generate multiple delivery attempts.

---

# 12.8 Delivery Attempts

Sometimes providers fail.

Example:

```text
SMTP

↓

Timeout

↓

Retry

↓

Success
```

Every attempt is recorded.

Table:

```text
notification.delivery_attempts
```

---

## Columns

| Column              | Type            |
| ------------------- | --------------- |
| id                  | UUID            |
| notification_id     | UUID            |
| provider            | VARCHAR         |
| provider_message_id | VARCHAR         |
| attempt_number      | INTEGER         |
| status              | delivery_status |
| started_at          | TIMESTAMPTZ     |
| finished_at         | TIMESTAMPTZ     |
| duration_ms         | INTEGER         |
| error_code          | VARCHAR         |
| error_message       | TEXT            |
| created_at          | TIMESTAMPTZ     |

---

# 12.9 Provider Responses

Different providers return different metadata.

Example:

SMTP:

```text
250 Message Accepted
```

SES:

```json
{
  "MessageId": "..."
}
```

Twilio:

```json
{
  "sid": "..."
}
```

FCM:

```json
{
  "messageId": "..."
}
```

Instead of storing every provider's schema in columns:

```text
provider_responses
```

---

## Columns

| Column              | Type        |
| ------------------- | ----------- |
| id                  | UUID        |
| delivery_attempt_id | UUID        |
| provider            | VARCHAR     |
| response            | JSONB       |
| received_at         | TIMESTAMPTZ |

JSONB allows support for any provider without schema changes.

---

# 12.10 Notification Preferences

Users may disable certain notifications.

Table:

```text
notification.notification_preferences
```

---

## Example

```text
Email

↓

Disabled
```

SMS:

```text
Enabled
```

Push:

```text
Enabled
```

---

## Columns

| Column     | Type                 |
| ---------- | -------------------- |
| id         | UUID                 |
| tenant_id  | UUID                 |
| user_id    | UUID                 |
| channel    | notification_channel |
| enabled    | BOOLEAN              |
| updated_at | TIMESTAMPTZ          |

---

# 12.11 Channel Metadata

Different channels require different data.

Email:

```text
subject

attachments

reply_to
```

SMS:

```text
phone_number
```

Push:

```text
device_token
```

Webhook:

```text
URL

Headers

Method
```

Rather than creating many nullable columns, channel-specific metadata is stored in JSONB.

---

# 12.12 Relationship Diagram

```text
notification_templates

        │

        ▼

notifications

        │

        ▼

delivery_attempts

        │

        ▼

provider_responses
```

Preferences remain independent.

---

# 12.13 Query Patterns

Recent notifications:

```sql
SELECT *
FROM notification.notifications
ORDER BY created_at DESC;
```

Failed deliveries:

```sql
SELECT *
FROM notification.delivery_attempts
WHERE status='FAILED';
```

User preferences:

```sql
SELECT *
FROM notification.notification_preferences
WHERE user_id=$1;
```

Provider statistics:

```sql
SELECT provider,
COUNT(*)
FROM notification.delivery_attempts
GROUP BY provider;
```

Template usage:

```sql
SELECT template_id,
COUNT(*)
FROM notification.notifications
GROUP BY template_id;
```

---

# 12.14 Constraints

Templates:

```sql
PRIMARY KEY(id)
```

Notifications:

```sql
template_id
REFERENCES notification.notification_templates(id)
```

Delivery:

```sql
notification_id
REFERENCES notification.notifications(id)
```

Provider Responses:

```sql
delivery_attempt_id
REFERENCES notification.delivery_attempts(id)
```

Checks:

```sql
attempt_number > 0
```

```sql
duration_ms >= 0
```

---

# 12.15 Index Strategy

Templates:

```text
(name)
```

Notifications:

```text
(status)
```

```text
(recipient)
```

```text
(created_at)
```

Delivery:

```text
(notification_id)
```

```text
(provider)
```

```text
(status)
```

Provider Responses:

```text
(delivery_attempt_id)
```

Composite:

```text
(provider, status)
```

Composite:

```text
(recipient, created_at)
```

---

# 12.16 Initial SQL Definition

## notification_templates

```sql
CREATE TABLE notification.notification_templates (

    id UUID PRIMARY KEY,

    name VARCHAR(255),

    channel notification_channel,

    subject TEXT,

    body TEXT,

    variables JSONB,

    locale VARCHAR(10),

    version INTEGER,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## notifications

```sql
CREATE TABLE notification.notifications (

    id UUID PRIMARY KEY,

    tenant_id UUID,

    job_id UUID,

    template_id UUID,

    recipient VARCHAR(255),

    channel notification_channel,

    status notification_status,

    payload JSONB,

    scheduled_at TIMESTAMPTZ,

    sent_at TIMESTAMPTZ,

    delivered_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## delivery_attempts

```sql
CREATE TABLE notification.delivery_attempts (

    id UUID PRIMARY KEY,

    notification_id UUID,

    provider VARCHAR(100),

    provider_message_id VARCHAR(255),

    attempt_number INTEGER,

    status delivery_status,

    started_at TIMESTAMPTZ,

    finished_at TIMESTAMPTZ,

    duration_ms INTEGER,

    error_code VARCHAR(100),

    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## provider_responses

```sql
CREATE TABLE notification.provider_responses (

    id UUID PRIMARY KEY,

    delivery_attempt_id UUID,

    provider VARCHAR(100),

    response JSONB,

    received_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 12.17 Why Multiple Tables?

Instead of:

```text
notifications
```

containing 70 columns,

we normalize the design.

Templates:

```text
Reusable Content
```

Notifications:

```text
Business Event
```

Delivery Attempts:

```text
Delivery History
```

Provider Responses:

```text
Provider Metadata
```

This keeps each table focused and avoids duplication.

---

# 12.18 Operational Dashboard

Typical metrics:

| Metric                      | Purpose            |
| --------------------------- | ------------------ |
| Notifications Sent          | Throughput         |
| Delivery Success Rate       | Reliability        |
| Retry Rate                  | Provider stability |
| Bounce Rate                 | Email quality      |
| SMS Failure Rate            | Carrier issues     |
| Average Delivery Time       | Performance        |
| Template Usage              | Product analytics  |
| Provider Error Distribution | Debugging          |

---

# 12.19 Future Evolution

```text
Email

↓

SMS

↓

Push

↓

Webhook

↓

Multi-Provider Routing

↓

AI Channel Selection

↓

Automatic Failover

↓

Global Notification Platform
```

Future versions may automatically select the best provider based on historical success rates.

---

# 12.20 Best Practices

- Keep notifications independent from scheduler internals.
- Version templates.
- Never overwrite delivery attempts.
- Store provider responses separately.
- Use JSONB for provider-specific metadata.
- Record every retry attempt.
- Respect user notification preferences.
- Support multiple delivery providers.
- Archive historical notifications.
- Build dashboards around delivery metrics.

---

# Chapter Summary

This chapter designed the persistence model for the Notification Service, including template management, logical notifications, delivery attempts, provider responses, and user preferences. By separating reusable content from delivery history and provider metadata, the system remains extensible, supports multiple communication channels, enables reliable retries, and provides comprehensive operational visibility into notification delivery.

---

# Next Chapter

**Filename:** `V2-C13-Audit-And-Event-Log.md`

**Chapter 13 — Audit Log & Domain Event Storage**

The next chapter will design the platform's auditing and event storage model. It will cover immutable audit logs, domain events, event sourcing considerations, actor tracking, compliance requirements, security auditing, event replay, and the relationship between audit records, business entities, and distributed tracing.

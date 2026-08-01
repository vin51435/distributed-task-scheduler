# ADR-001: Selection of RabbitMQ as Core Message Broker

## Context

The Distributed Task Scheduler requires a message broker to queue dispatched jobs for execution by worker nodes. Key requirements include low latency delivery, message acknowledgment guarantees (at-least-once), dead-lettering capabilities, and flow control/prefetch management.

## Decision

We chose **RabbitMQ** over Apache Kafka or AWS SQS for primary job dispatch.

## Rationale

- **Targeted Job Queueing**: Task dispatch requires competing consumer queues where individual messages are acknowledged upon successful execution. RabbitMQ AMQP work queues match this model natively.
- **Dead-Letter Exchange (DLX)**: Failed jobs after max retries can be routed automatically to DLQs without custom application logic.
- **Prefetch Control**: Workers can control concurrency via `qos(prefetchCount)` to prevent worker overload.

## Consequences

- Requires AMQP connection management and heartbeats.
- Message order is guaranteed per queue partition but not globally across all queues.

# ADR-002: Selection of PostgreSQL as Primary Relational Database

## Context

The system requires an ACID-compliant primary data store for task definitions, execution history, user accounts, and tenant metadata.

## Decision

We chose **PostgreSQL 16** as the single source of truth data store.

## Rationale

- **ACID Transactions**: Guarantees atomic schedule creation and execution state transitions.
- **FOR UPDATE SKIP LOCKED**: Enables efficient, lock-free, concurrent database scanning for due tasks across partitioned scanners.
- **JSONB Support**: Allows storing dynamic job payloads and execution result metadata alongside structured fields.

## Consequences

- Requires connection pooling (e.g., PgBouncer in high-scale environments).
- Requires time-based partitioning for execution history at high volumes.

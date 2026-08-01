# ADR-003: Selection of gRPC for Internal Microservice Communication

## Context

Internal microservices require high-performance, strongly typed, low-overhead inter-service communication for internal operations (e.g., Gateway to Scheduler, Scheduler to Worker).

## Decision

We chose **gRPC (HTTP/2 + Protocol Buffers)** for synchronous internal service-to-service RPC calls.

## Rationale

- **Binary Serialization**: Protocol Buffers are significantly faster and smaller than JSON over HTTP/1.1.
- **Strong Contracts**: `.proto` files serve as the single source of truth for microservice contracts across the monorepo.
- **Multiplexing**: HTTP/2 single connection multiplexing reduces latency for high-frequency internal calls.

## Consequences

- Requires Protobuf compilation tools (`protoc` / `@grpc/proto-loader`).
- External client traffic still passes through REST API Gateway.

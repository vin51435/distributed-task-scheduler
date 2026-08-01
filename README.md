# Distributed Task Scheduler

A fault-tolerant, highly available, and scalable distributed task scheduling and execution system.

## Project Structure

```text
scheduler-platform/
├── apps/         # Applications (Scheduler, Scanner, Dispatcher, Worker, etc.)
├── packages/     # Shared packages (database, grpc, rabbitmq, redis, etc.)
├── proto/        # Protocol buffer definitions
├── docker/       # Local infrastructure setup (Docker Compose)
├── kubernetes/   # Kubernetes manifests and Helm charts
└── docs/         # Architectural documentation
```

## Infrastructure (Phase 2)

Local development infrastructure is managed via Docker Compose.

### Quick Start

```bash
# Start all local infrastructure services (PostgreSQL, Redis, RabbitMQ, Prometheus, Grafana, Jaeger)
npm run docker:up

# View container logs
npm run docker:logs

# Stop infrastructure services
npm run docker:down
```

### Infrastructure Services & Endpoints

| Service           | Host Port | Internal Port | Description / UI Link                                                      |
| :---------------- | :-------- | :------------ | :------------------------------------------------------------------------- |
| **PostgreSQL**    | `5432`    | `5432`        | Primary Relational Database (`scheduler_db`)                               |
| **Redis**         | `6379`    | `6379`        | Cache & In-Memory Store                                                    |
| **RabbitMQ AMQP** | `5672`    | `5672`        | Message Broker AMQP Port                                                   |
| **RabbitMQ UI**   | `15672`   | `15672`       | [http://localhost:15672](http://localhost:15672) (`guest`/`guest`)         |
| **Prometheus**    | `9090`    | `9090`        | [http://localhost:9090](http://localhost:9090) Metrics Collector           |
| **Grafana**       | `3000`    | `3000`        | [http://localhost:3000](http://localhost:3000) Dashboard (`admin`/`admin`) |
| **Jaeger**        | `16686`   | `16686`       | [http://localhost:16686](http://localhost:16686) Distributed Tracing UI    |

## Development Roadmap

- [x] **Phase 1 — Repository Setup**: Nx Monorepo with NestJS, TypeScript, ESLint, Prettier.
- [x] **Phase 2 — Infrastructure**: Docker Compose with PostgreSQL, Redis, RabbitMQ, Prometheus, Grafana, Jaeger.
- [ ] **Phase 3 — Shared Packages**: Reusable infrastructure libraries (`database`, `rabbitmq`, `redis`, etc.).
- [ ] **Phase 4 — First Service**: Scheduler CRUD API.

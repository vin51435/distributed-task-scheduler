# Distributed Task Scheduler — CLI Commands & Developer Cheat Sheet

This document serves as a reference for running, testing, scaling, and extending the Distributed Task Scheduler platform.

---

## 1. Local Multi-Node Cluster Execution (Git Bash / Linux)

Run each service in separate terminal windows to simulate a multi-node distributed cluster locally:

### 🌐 Terminal 1 — Scheduler Service (API Gateway)

```bash
PORT=3000 npx nx serve scheduler
```

### 🔍 Terminal 2 — Scanner Node A (Bucket Partitioning Mode)

```bash
SCANNER_INSTANCE_ID="scanner-A" SCANNER_MODE="BUCKET" PORT=3002 npx nx serve scanner
```

### 🔍 Terminal 3 — Scanner Node B (Bucket Partitioning Mode)

```bash
SCANNER_INSTANCE_ID="scanner-B" SCANNER_MODE="BUCKET" PORT=3005 npx nx serve scanner
```

### ⚡ Terminal 4 — Dispatcher Node A (Atomic Batch Claiming)

```bash
DISPATCHER_INSTANCE_ID="dispatcher-A" PORT=3003 npx nx serve dispatcher
```

### ⚡ Terminal 5 — Dispatcher Node B (Atomic Batch Claiming)

```bash
DISPATCHER_INSTANCE_ID="dispatcher-B" PORT=3006 npx nx serve dispatcher
```

### 👷 Terminal 6 — Worker Node A

```bash
WORKER_INSTANCE_ID="worker-1" PORT=3004 npx nx serve worker
```

### 👷 Terminal 7 — Worker Node B

```bash
WORKER_INSTANCE_ID="worker-2" PORT=3007 npx nx serve worker
```

---

## 2. Infrastructure Services (Docker Compose)

Start required background infrastructure (PostgreSQL, Redis, RabbitMQ):

```bash
# Start all infrastructure services
docker compose up -d

# Check status of running containers
docker compose ps

# View container logs
docker compose logs -f

# Stop infrastructure services
docker compose down
```

### Management Web Consoles & Ports:

- **Scheduler API**: `http://localhost:3000/api`
- **Swagger Docs**: `http://localhost:3000/api/docs`
- **RabbitMQ Management Dashboard**: `http://localhost:15672` (Login: `guest` / `guest`)
- **PostgreSQL Database**: `localhost:5432` (`postgres` / `postgrespassword` / `scheduler_db`)
- **Redis Server**: `localhost:6379`

---

## 3. Creating New Microservices & Libraries (Nx Generators)

### Create a New NestJS Microservice Application:

```bash
npx nx g @nx/nest:app apps/<app-name>
```

### Create a New Shared Platform Package/Library:

```bash
npx nx g @nx/js:lib packages/<package-name>
```

### Build Projects:

```bash
# Build a single service
npx nx build <service-name>

# Build all apps and packages in monorepo
npm run build
# OR: npx nx run-many -t build
```

---

## 4. Running Tests & Quality Verification

### Run Unit & Integration Tests:

```bash
# Run all workspace unit tests
npm run test

# Run tests for a specific package/app
npx nx test redis
npx nx test scheduler
npx nx test dispatcher
npx nx test worker

# Run a specific spec file directly
npx jest apps/scanner-e2e/src/scanner/distributed-coordination.spec.ts --globalSetup="" --globalTeardown=""
```

### Code Linting & Formatting:

```bash
# Run ESLint across workspace
npm run lint

# Check code formatting with Prettier
npm run format:check

# Auto-fix formatting across workspace
npm run format
```

### TypeScript Type Checking:

```bash
npx tsc --noEmit
```

---

## 5. Testing Schedule APIs & Load Simulation (`curl`)

### Create a Recurring CRON Schedule (Every 5 seconds):

```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Recurring Email Task",
    "type": "CRON",
    "cron": "*/5 * * * * *",
    "workerType": "EMAIL",
    "payload": { "to": "user@example.com", "subject": "Hello World" }
  }'
```

### Create a One-Time Delayed Task:

```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Delayed Webhook Task",
    "type": "ONE_TIME",
    "cron": "2026-08-03T22:00:00.000Z",
    "workerType": "WEBHOOK",
    "payload": { "url": "https://httpbin.org/post" }
  }'
```

### Batch Create 10 Schedules for Race-Condition & Scaling Verification:

```bash
for i in {1..10}; do
  curl -s -X POST http://localhost:3000/api/schedules \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Batch Task '$i'",
      "type": "CRON",
      "cron": "*/5 * * * * *",
      "workerType": "EMAIL",
      "payload": { "emailId": '$i' }
    }' > /dev/null
done
```

---

## 6. Database & Redis Inspection Commands

### Check Job Execution Status Counts in PostgreSQL:

```bash
docker exec -it scheduler_postgres psql -U postgres -d scheduler_db -c "SELECT status, COUNT(*) FROM jobs GROUP BY status;"
```

### Inspect Schedules & Bucket Assignments in PostgreSQL:

```bash
docker exec -it scheduler_postgres psql -U postgres -d scheduler_db -c "SELECT id, name, bucket, status, next_execute_at FROM schedules LIMIT 10;"
```

### Inspect Redis Keys & Active Bucket Leases:

```bash
# Connect to Redis CLI
docker exec -it scheduler_redis redis-cli

# List all active scanner bucket leases
KEYS "bucket:lease:*"

# List active instance heartbeats
KEYS "scanner:instance:*"
KEYS "dispatcher:instance:*"

# Check active worker job heartbeats
KEYS "worker:job:*"
```

---

## 7. Git & Commit Workflows

### Create a Standard Conventional Commit:

```bash
git add .
git commit -m "feat(service-name): brief description of change"
```

### Push Branch & Create GitHub Pull Request:

```bash
git push origin feat/initial-development
$env:GITHUB_TOKEN=""; gh pr create --title "PR Title" --body "PR Description" --base main --head feat/initial-development
```

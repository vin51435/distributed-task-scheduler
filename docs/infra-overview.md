### How to Check the PostgreSQL Database

#### Option A: Via Command Line (`docker exec` + `psql`)

Run this in your terminal to see all stored schedules:

```bash
docker exec -it scheduler_postgres psql -U postgres -d scheduler_db -c "SELECT id, name, type, status, created_at FROM schedules;"
```

Or enter the interactive PostgreSQL prompt:

```bash
docker exec -it scheduler_postgres psql -U postgres -d scheduler_db
```

Inside `psql`:

- `\dt` — List all tables (you will see the `schedules` table)
- `SELECT * FROM schedules;` — View all schedule rows
- `\q` — Quit

#### Option B: Via GUI Database Client (DBeaver, TablePlus, DataGrip, VS Code extension)

Connect using these credentials:

- **Host**: `localhost`
- **Port**: `5433`
- **Database**: `scheduler_db`
- **Username**: `postgres`
- **Password**: `postgres`

---

### 3. How to Access Observability & Infrastructure Dashboards

All observability services are running in your Docker environment:

| Service                 | Purpose                     | URL                                                 | Default Credentials            |
| :---------------------- | :-------------------------- | :-------------------------------------------------- | :----------------------------- |
| **Grafana**             | Visual Metrics & Dashboards | 👉 [http://localhost:3000](http://localhost:3000)   | User: `admin`<br>Pass: `admin` |
| **Prometheus**          | Metrics Collection          | 👉 [http://localhost:9090](http://localhost:9090)   | None                           |
| **Jaeger UI**           | Distributed Tracing         | 👉 [http://localhost:16686](http://localhost:16686) | None                           |
| **RabbitMQ Management** | Queue & Message Broker UI   | 👉 [http://localhost:15672](http://localhost:15672) | User: `guest`<br>Pass: `guest` |

Terminal 1 — Scheduler Service (API Gateway)
bash

PORT=3000 npx nx serve scheduler
Terminal 2 — Scanner Node A (Bucket Mode)
bash

SCANNER_INSTANCE_ID="scanner-A" SCANNER_MODE="BUCKET" SCANNER_PORT=3002 npx nx serve scanner
Terminal 3 — Scanner Node B (Bucket Mode)
bash

SCANNER_INSTANCE_ID="scanner-B" SCANNER_MODE="BUCKET" SCANNER_PORT=3005 npx nx serve scanner
Terminal 4 — Dispatcher Node A
bash

DISPATCHER_INSTANCE_ID="dispatcher-A" DISPATCHER_PORT=3003 npx nx serve dispatcher
Terminal 5 — Dispatcher Node B
bash

DISPATCHER_INSTANCE_ID="dispatcher-B" DISPATCHER_PORT=3006 npx nx serve dispatcher
Terminal 6 — Worker Node A
bash

WORKER_INSTANCE_ID="worker-3" WORKER_PORT=3008 npx nx serve worker

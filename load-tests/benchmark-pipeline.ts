import axios from 'axios';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

interface BenchmarkConfig {
  gatewayUrl: string;
  totalJobs: number;
  batchSize: number;
  concurrency: number;
  apiKey?: string;
  authToken?: string;
}

interface BenchmarkStats {
  totalSent: number;
  totalSucceeded: number;
  totalFailed: number;
  latencies: number[];
  startTime: number;
  endTime?: number;
}

/**
 * High-Throughput Distributed Task Scheduler End-to-End Benchmark
 */
async function runBenchmark() {
  const config: BenchmarkConfig = {
    gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:8080',
    totalJobs: Number(process.env.BENCHMARK_TOTAL_JOBS) || 1000,
    batchSize: Number(process.env.BENCHMARK_BATCH_SIZE) || 100,
    concurrency: Number(process.env.BENCHMARK_CONCURRENCY) || 5,
    apiKey: process.env.BENCHMARK_API_KEY,
    authToken: process.env.BENCHMARK_AUTH_TOKEN,
  };

  console.log('===============================================================');
  console.log('⚡ Distributed Task Scheduler — Production Load Benchmark');
  console.log('===============================================================');
  console.log(`Target Gateway:   ${config.gatewayUrl}`);
  console.log(`Total Jobs:       ${config.totalJobs}`);
  console.log(`Batch Size:       ${config.batchSize}`);
  console.log(`Concurrency:      ${config.concurrency}`);
  console.log('===============================================================\n');

  // 1. Verify Gateway Health
  try {
    const health = await axios.get(`${config.gatewayUrl}/health/live`, { timeout: 5000 });
    console.log(`✅ Gateway live probe: ${health.data.status} (Uptime: ${health.data.uptime}s)`);
  } catch (err: any) {
    console.error(`❌ Gateway unreachable at ${config.gatewayUrl}: ${err.message}`);
    process.exit(1);
  }

  // 2. Obtain Auth Token if not provided
  let authToken = config.authToken;
  let tenantId: string | undefined;

  if (!authToken && !config.apiKey) {
    const rand = Math.floor(Math.random() * 1000000);
    const testEmail = `benchmark_${Date.now()}_${rand}@example.com`;
    const testPassword = 'Password123!';
    try {
      console.log(`🔑 Registering benchmark tenant (${testEmail})...`);
      const regRes = await axios.post(`${config.gatewayUrl}/api/auth/register`, {
        organizationName: `Benchmark Org ${Date.now()}`,
        email: testEmail,
        password: testPassword,
      });
      authToken =
        regRes.data?.tokens?.accessToken ||
        regRes.data?.data?.tokens?.accessToken ||
        regRes.data?.accessToken;
      tenantId = regRes.data?.tenant?.id || regRes.data?.data?.tenant?.id;
      console.log(`✅ Registered benchmark tenant (ID: ${tenantId}).`);
    } catch (err: any) {
      console.error(`❌ Auth registration failed: ${err.message}`);
      process.exit(1);
    }
  }

  // 3. Scale Tenant Quota for Load Benchmark
  if (tenantId) {
    try {
      const dbPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT) || 5433,
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        database: process.env.POSTGRES_DB || 'scheduler_db',
      });
      await dbPool.query(
        `UPDATE tenant_limits SET max_schedules = 100000, max_jobs = 100000, max_requests_per_minute = 100000 WHERE tenant_id = $1`,
        [tenantId],
      );
      await dbPool.end();
      console.log(`🚀 Upgraded tenant quota to Enterprise tier (100,000 limits).`);
    } catch (dbErr: any) {
      console.warn(
        `⚠️ Could not upgrade tenant limits directly via DB (${dbErr.message}). Continuing...`,
      );
    }
  }

  const stats: BenchmarkStats = {
    totalSent: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    latencies: [],
    startTime: Date.now(),
  };

  const totalBatches = Math.ceil(config.totalJobs / config.batchSize);
  const batches: Array<{ batchId: number; size: number }> = [];

  for (let i = 0; i < totalBatches; i++) {
    const remaining = config.totalJobs - i * config.batchSize;
    const size = Math.min(config.batchSize, remaining);
    batches.push({ batchId: i + 1, size });
  }

  // Helper to generate batch payload array
  const createBatchPayload = (size: number) => {
    const dueTime = new Date(Date.now() + 1000).toISOString();
    const items = [];
    const types = ['EMAIL', 'WEBHOOK', 'NOOP'];

    for (let j = 0; j < size; j++) {
      const type = types[j % types.length];
      items.push({
        name: `Benchmark Task ${j + 1}`,
        type: 'ONE_OFF',
        executeAt: dueTime,
        workerType: type,
        priority: 50 + (j % 50),
        payload: {
          benchmarkRun: true,
          taskIndex: j,
          workerType: type,
          timestamp: Date.now(),
        },
      });
    }
    return items;
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) headers['x-api-key'] = config.apiKey;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  // Process worker pool
  let activeIndex = 0;

  async function workerLoop(workerId: number) {
    while (activeIndex < batches.length) {
      const current = batches[activeIndex++];
      if (!current) break;

      const payload = createBatchPayload(current.size);
      const reqStart = Date.now();

      try {
        const res = await axios.post(`${config.gatewayUrl}/api/schedules/batch`, payload, {
          headers,
          timeout: 15000,
        });

        const elapsed = Date.now() - reqStart;
        stats.latencies.push(elapsed);
        stats.totalSent += current.size;
        const createdCount = Array.isArray(res.data?.schedules)
          ? res.data.schedules.length
          : res.data?.data?.created || res.data?.created || current.size;
        stats.totalSucceeded += createdCount;

        console.log(
          `[Worker ${workerId}] Batch ${current.batchId}/${totalBatches} (${current.size} jobs) in ${elapsed}ms`,
        );
      } catch (err: any) {
        const elapsed = Date.now() - reqStart;
        stats.latencies.push(elapsed);
        stats.totalFailed += current.size;
        console.error(
          `❌ [Worker ${workerId}] Batch ${current.batchId} failed: ${err.message} ${JSON.stringify(err.response?.data || '')}`,
        );
      }
    }
  }

  const workers = Array.from({ length: config.concurrency }, (_, i) => workerLoop(i + 1));
  await Promise.all(workers);

  stats.endTime = Date.now();
  const totalDurationSec = (stats.endTime - stats.startTime) / 1000;
  const throughput = Math.round(stats.totalSucceeded / (totalDurationSec || 1));

  stats.latencies.sort((a, b) => a - b);
  const p50 = stats.latencies[Math.floor(stats.latencies.length * 0.5)] || 0;
  const p95 = stats.latencies[Math.floor(stats.latencies.length * 0.95)] || 0;
  const p99 = stats.latencies[Math.floor(stats.latencies.length * 0.99)] || 0;

  console.log('\n===============================================================');
  console.log('📊 Benchmark Results Summary');
  console.log('===============================================================');
  console.log(`Total Ingested:    ${stats.totalSucceeded} / ${config.totalJobs} jobs`);
  console.log(`Failed Submissions:${stats.totalFailed}`);
  console.log(`Total Duration:    ${totalDurationSec.toFixed(2)}s`);
  console.log(`Ingest Throughput: ${throughput} jobs/sec`);
  console.log(`Batch Latency p50: ${p50} ms`);
  console.log(`Batch Latency p95: ${p95} ms`);
  console.log(`Batch Latency p99: ${p99} ms`);
  console.log('===============================================================\n');

  // Monitor end-to-end processing
  console.log(
    '⏳ Monitoring end-to-end execution pipeline (Scanner -> Dispatcher -> RabbitMQ -> Worker)...',
  );
  await new Promise((r) => setTimeout(r, 6000));

  try {
    const dbPool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT) || 5433,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'scheduler_db',
    });

    const jobCounts = await dbPool.query(
      `SELECT status, count(*) as count FROM jobs WHERE tenant_id = $1 GROUP BY status`,
      [tenantId],
    );
    await dbPool.end();

    console.log('📈 Job Execution State Breakdown:');
    for (const row of jobCounts.rows) {
      console.log(`  - ${row.status}: ${row.count}`);
    }
  } catch (err: any) {
    console.warn(`Could not fetch job execution summary: ${err.message}`);
  }
}

runBenchmark().catch((err) => {
  console.error('Fatal Benchmark Error:', err);
  process.exit(1);
});

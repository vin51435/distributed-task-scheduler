import axios from 'axios';

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
    const health = await axios.get(`${config.gatewayUrl}/health/live`, { timeout: 3000 });
    console.log(`✅ Gateway live probe: ${health.data.status} (Uptime: ${health.data.uptime}s)`);
  } catch (err: any) {
    console.error(`❌ Gateway unreachable at ${config.gatewayUrl}: ${err.message}`);
    process.exit(1);
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

  // Helper to generate batch payload
  const createBatchPayload = (size: number) => {
    const dueTime = new Date(Date.now() + 2000).toISOString();
    const items = [];
    const types = ['EMAIL', 'WEBHOOK', 'AI', 'COMPRESSION', 'IMAGE_PROCESSING', 'NOOP'];

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
  if (config.authToken) headers['Authorization'] = `Bearer ${config.authToken}`;

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
          timeout: 10000,
        });

        const elapsed = Date.now() - reqStart;
        stats.latencies.push(elapsed);
        stats.totalSent += current.size;
        stats.totalSucceeded += res.data?.created || current.size;

        process.stdout.write(
          `[Worker ${workerId}] Batch ${current.batchId}/${totalBatches} (${current.size} jobs) in ${elapsed}ms\r`,
        );
      } catch (err: any) {
        const elapsed = Date.now() - reqStart;
        stats.latencies.push(elapsed);
        stats.totalFailed += current.size;
        console.error(`\n❌ [Worker ${workerId}] Batch ${current.batchId} failed: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: config.concurrency }, (_, i) => workerLoop(i + 1));
  await Promise.all(workers);

  stats.endTime = Date.now();
  const totalDurationSec = (stats.endTime - stats.startTime) / 1000;
  const throughput = Math.round(stats.totalSucceeded / totalDurationSec);

  stats.latencies.sort((a, b) => a - b);
  const p50 = stats.latencies[Math.floor(stats.latencies.length * 0.5)] || 0;
  const p95 = stats.latencies[Math.floor(stats.latencies.length * 0.95)] || 0;
  const p99 = stats.latencies[Math.floor(stats.latencies.length * 0.99)] || 0;

  console.log('\n\n===============================================================');
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
}

runBenchmark().catch((err) => {
  console.error('Fatal Benchmark Error:', err);
  process.exit(1);
});

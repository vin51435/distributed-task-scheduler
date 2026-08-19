import axios from 'axios';

describe('Worker Service Operational API (e2e)', () => {
  it('GET /api/health - should return service health status', async () => {
    const res = await axios.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('status');
    const checks = res.data.checks || res.data.details;
    expect(checks).toHaveProperty('database');
    expect(checks).toHaveProperty('rabbitmq');
  });

  it('GET /api/metrics - should return Prometheus worker operational metrics', async () => {
    const res = await axios.get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.data).toContain('worker_running_jobs');
  });
});

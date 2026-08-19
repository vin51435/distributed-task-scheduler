import axios from 'axios';

describe('Dispatcher Service Operational API (e2e)', () => {
  it('GET /api/health - should return service health status', async () => {
    const res = await axios.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('status');
    const checks = res.data.checks || res.data.details;
    expect(checks).toHaveProperty('database');
    expect(checks).toHaveProperty('rabbitmq');
  });

  it('POST /api/dispatch - should execute manual dispatch batch', async () => {
    const res = await axios.post('/api/dispatch');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('message', 'Dispatch batch completed');
    expect(res.data.data).toHaveProperty('fetched');
    expect(res.data.data).toHaveProperty('dispatched');
    expect(res.data.data).toHaveProperty('failed');
  });

  it('GET /api/metrics - should return Prometheus dispatcher operational metrics', async () => {
    const res = await axios.get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.data).toContain('dispatcher_publish_total');
  });
});

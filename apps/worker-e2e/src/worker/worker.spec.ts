import axios from 'axios';

describe('Worker Service Operational API (e2e)', () => {
  it('GET /api/health - should return service health status', async () => {
    const res = await axios.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('status');
    expect(res.data).toHaveProperty('details');
    expect(res.data.details).toHaveProperty('database');
    expect(res.data.details).toHaveProperty('rabbitmq');
  });

  it('GET /api/metrics - should return worker operational metrics', async () => {
    const res = await axios.get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('status', 'ok');
    expect(res.data).toHaveProperty('metrics');
    expect(res.data.metrics).toHaveProperty('totalProcessed');
    expect(res.data.metrics).toHaveProperty('totalSucceeded');
    expect(res.data.metrics).toHaveProperty('totalFailed');
    expect(res.data.metrics).toHaveProperty('activeExecutions');
  });
});

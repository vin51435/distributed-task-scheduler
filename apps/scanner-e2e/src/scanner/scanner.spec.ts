import axios from 'axios';

describe('Scanner Service Operational API (e2e)', () => {
  it('GET /api/health - should return status ok', async () => {
    const res = await axios.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(typeof res.data.uptime).toBe('number');
  });

  it('POST /api/scan - should execute manual scan cycle', async () => {
    const res = await axios.post('/api/scan');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('scannedSchedules');
    expect(res.data).toHaveProperty('jobsCreated');
  });

  it('GET /api/metrics - should return scanner metrics', async () => {
    const res = await axios.get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('totalScans');
    expect(res.data).toHaveProperty('jobsCreated');
  });
});

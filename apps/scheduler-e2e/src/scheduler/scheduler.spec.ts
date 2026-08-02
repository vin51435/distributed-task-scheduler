import axios from 'axios';

describe('Scheduler Service API (e2e)', () => {
  let createdScheduleId: string;

  it('POST /api/schedules - should create a new CRON schedule with nextExecuteAt', async () => {
    const res = await axios.post('/api/schedules', {
      name: 'E2E Test CRON Schedule',
      description: 'Created via E2E test suite',
      type: 'CRON',
      cron: '0 12 * * *',
      timezone: 'UTC',
      payload: { action: 'cleanup' },
    });

    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty('id');
    expect(res.data.name).toBe('E2E Test CRON Schedule');
    expect(res.data.type).toBe('CRON');
    expect(res.data.status).toBe('ACTIVE');
    expect(res.data).toHaveProperty('nextExecuteAt');
    expect(res.data.nextExecuteAt).not.toBeNull();

    createdScheduleId = res.data.id;
  });

  it('POST /api/schedules - should create a new ONE_OFF schedule', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const res = await axios.post('/api/schedules', {
      name: 'E2E Test ONE_OFF Schedule',
      type: 'ONE_OFF',
      executeAt: futureDate,
      timezone: 'America/New_York',
      payload: { action: 'notify' },
    });

    expect(res.status).toBe(201);
    expect(res.data.name).toBe('E2E Test ONE_OFF Schedule');
    expect(res.data.type).toBe('ONE_OFF');
    expect(res.data.status).toBe('ACTIVE');
  });

  it('GET /api/schedules - should return list of schedules', async () => {
    const res = await axios.get('/api/schedules');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('GET /api/schedules/:id - should return single schedule by ID', async () => {
    const res = await axios.get(`/api/schedules/${createdScheduleId}`);

    expect(res.status).toBe(200);
    expect(res.data.id).toBe(createdScheduleId);
    expect(res.data.name).toBe('E2E Test CRON Schedule');
  });

  it('PATCH /api/schedules/:id - should update schedule name and status', async () => {
    const res = await axios.patch(`/api/schedules/${createdScheduleId}`, {
      name: 'Updated E2E CRON Schedule',
      status: 'PAUSED',
    });

    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Updated E2E CRON Schedule');
    expect(res.data.status).toBe('PAUSED');
  });

  it('DELETE /api/schedules/:id - should delete schedule', async () => {
    const deleteRes = await axios.delete(`/api/schedules/${createdScheduleId}`);
    expect(deleteRes.status).toBe(204);

    try {
      await axios.get(`/api/schedules/${createdScheduleId}`);
    } catch (err: any) {
      expect(err.response.status).toBe(404);
    }
  });
});

import { SchedulerPlatformClient } from './client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SchedulerPlatformClient', () => {
  let client: SchedulerPlatformClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    client = new SchedulerPlatformClient({
      baseUrl: 'http://localhost:8080',
      apiKey: 'pts_live_testkey123',
      tenantId: 'tenant-123',
    });
  });

  it('should initialize with base URL and auth headers', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:8080',
      timeout: 10000,
    });
  });

  it('should invoke create schedule endpoint', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { id: 'sched-1', name: 'Billing Cron' },
    });

    const result = await client.schedules.create({
      name: 'Billing Cron',
      type: 'CRON',
      cron: '0 0 * * *',
      payload: { action: 'generate_invoices' },
    });

    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/schedules', {
      name: 'Billing Cron',
      type: 'CRON',
      cron: '0 0 * * *',
      payload: { action: 'generate_invoices' },
    });
    expect(result.id).toBe('sched-1');
  });

  it('should invoke batch schedule creation', async () => {
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { created: 2, schedules: [{ id: '1' }, { id: '2' }] },
    });

    const result = await client.schedules.createBatch([
      { name: 'Job 1', type: 'ONE_OFF', payload: {} },
      { name: 'Job 2', type: 'ONE_OFF', payload: {} },
    ]);

    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/schedules/batch', expect.any(Array));
    expect(result.created).toBe(2);
  });

  it('should invoke search jobs endpoint', async () => {
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: { jobs: [], total: 0, page: 1, limit: 20 },
    });

    const result = await client.jobs.search({ status: 'READY', workerType: 'EMAIL' });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/admin/jobs', {
      params: { status: 'READY', workerType: 'EMAIL' },
    });
    expect(result.total).toBe(0);
  });
});

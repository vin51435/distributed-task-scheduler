import axios, { AxiosInstance } from 'axios';
import {
  ClientConfig,
  RegisterParams,
  LoginParams,
  CreateScheduleParams,
  UpdateScheduleParams,
  JobSearchParams,
  CreateApiKeyParams,
} from './types';

export class SchedulerPlatformClient {
  private readonly http: AxiosInstance;
  private accessToken?: string;
  private refreshToken?: string;
  private apiKey?: string;
  private tenantId?: string;

  constructor(config: ClientConfig) {
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.apiKey = config.apiKey;
    this.tenantId = config.tenantId;

    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/+$/, ''),
      timeout: config.timeoutMs || 10000,
    });

    this.http.interceptors.request.use((req) => {
      if (this.apiKey) {
        req.headers['x-api-key'] = this.apiKey;
      } else if (this.accessToken) {
        req.headers['authorization'] = `Bearer ${this.accessToken}`;
      }
      if (this.tenantId) {
        req.headers['x-tenant-id'] = this.tenantId;
      }
      return req;
    });
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public setTenantId(tenantId: string) {
    this.tenantId = tenantId;
  }

  // --- Auth Namespace ---
  public readonly auth = {
    register: async (params: RegisterParams) => {
      const res = await this.http.post('/api/auth/register', params);
      if (res.data.tokens?.accessToken) {
        this.accessToken = res.data.tokens.accessToken;
        this.refreshToken = res.data.tokens.refreshToken;
      }
      if (res.data.tenant?.id) {
        this.tenantId = res.data.tenant.id;
      }
      return res.data;
    },

    login: async (params: LoginParams) => {
      const res = await this.http.post('/api/auth/login', params);
      if (res.data.tokens?.accessToken) {
        this.accessToken = res.data.tokens.accessToken;
        this.refreshToken = res.data.tokens.refreshToken;
      }
      if (res.data.user?.tenantId) {
        this.tenantId = res.data.user.tenantId;
      }
      return res.data;
    },

    refreshToken: async (token?: string) => {
      const targetToken = token || this.refreshToken;
      const res = await this.http.post('/api/auth/refresh', { refreshToken: targetToken });
      if (res.data.accessToken) {
        this.accessToken = res.data.accessToken;
        this.refreshToken = res.data.refreshToken;
      }
      return res.data;
    },

    getProfile: async () => {
      const res = await this.http.get('/api/auth/me');
      return res.data;
    },
  };

  // --- Schedules Namespace ---
  public readonly schedules = {
    create: async (params: CreateScheduleParams) => {
      const res = await this.http.post('/api/schedules', params);
      return res.data;
    },

    createBatch: async (items: CreateScheduleParams[]) => {
      const res = await this.http.post('/api/schedules/batch', items);
      return res.data;
    },

    list: async () => {
      const res = await this.http.get('/api/schedules');
      return res.data;
    },

    get: async (id: string) => {
      const res = await this.http.get(`/api/schedules/${id}`);
      return res.data;
    },

    update: async (id: string, params: UpdateScheduleParams) => {
      const res = await this.http.patch(`/api/schedules/${id}`, params);
      return res.data;
    },

    delete: async (id: string) => {
      const res = await this.http.delete(`/api/schedules/${id}`);
      return res.data;
    },

    pause: async (id: string) => {
      const res = await this.http.post(`/api/schedules/${id}/pause`);
      return res.data;
    },

    resume: async (id: string) => {
      const res = await this.http.post(`/api/schedules/${id}/resume`);
      return res.data;
    },
  };

  // --- Jobs Namespace ---
  public readonly jobs = {
    search: async (params?: JobSearchParams) => {
      const res = await this.http.get('/api/admin/jobs', { params });
      return res.data;
    },

    retry: async (jobId: string) => {
      const res = await this.http.post(`/api/admin/jobs/${jobId}/retry`);
      return res.data;
    },

    cancel: async (jobId: string) => {
      const res = await this.http.post(`/api/admin/jobs/${jobId}/cancel`);
      return res.data;
    },

    getAudit: async (jobId: string) => {
      const res = await this.http.get(`/api/admin/jobs/${jobId}/audit`);
      return res.data;
    },
  };

  // --- Executions Namespace ---
  public readonly executions = {
    list: async (jobId?: string, page = 1, limit = 20) => {
      const res = await this.http.get('/api/admin/executions', {
        params: { jobId, page, limit },
      });
      return res.data;
    },

    replay: async (executionId: string) => {
      const res = await this.http.post(`/api/admin/executions/${executionId}/replay`);
      return res.data;
    },
  };

  // --- Tenants Namespace ---
  public readonly tenants = {
    getCurrent: async () => {
      const res = await this.http.get('/api/tenants/current');
      return res.data;
    },

    getLimits: async (tenantId: string) => {
      const res = await this.http.get(`/api/tenants/${tenantId}/limits`);
      return res.data;
    },
  };

  // --- API Keys Namespace ---
  public readonly apiKeys = {
    create: async (params: CreateApiKeyParams) => {
      const res = await this.http.post('/api/api-keys', params);
      return res.data;
    },

    list: async () => {
      const res = await this.http.get('/api/api-keys');
      return res.data;
    },

    revoke: async (id: string) => {
      const res = await this.http.delete(`/api/api-keys/${id}`);
      return res.data;
    },
  };
}

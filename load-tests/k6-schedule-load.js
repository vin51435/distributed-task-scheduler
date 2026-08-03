import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000/api';

export default function () {
  const payload = JSON.stringify({
    cronExpression: '*/5 * * * *',
    payload: {
      action: 'process_data',
      batchSize: Math.floor(Math.random() * 100) + 1,
    },
    workerType: 'default',
    tenantId: `tenant-${Math.floor(Math.random() * 10) + 1}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/schedules`, payload, params);

  check(res, {
    'is status 201': (r) => r.status === 201,
    'response has schedule id': (r) => JSON.parse(r.body).id !== undefined,
  });

  sleep(0.1);
}

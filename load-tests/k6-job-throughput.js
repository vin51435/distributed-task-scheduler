import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    admin_queries: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<200'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000/api';

export default function () {
  const resJobs = http.get(`${BASE_URL}/admin/jobs?limit=50`);
  check(resJobs, {
    'GET /admin/jobs status 200': (r) => r.status === 200,
  });

  const resQueues = http.get(`${BASE_URL}/admin/queues`);
  check(resQueues, {
    'GET /admin/queues status 200': (r) => r.status === 200,
  });

  sleep(0.05);
}

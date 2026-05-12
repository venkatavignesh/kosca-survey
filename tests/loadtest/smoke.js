// k6 load-test baseline for the Kosca Survey app.
//
// Run locally:
//   k6 run --vus 10 --duration 30s tests/loadtest/smoke.js
//
// Run against a deployed instance:
//   BASE_URL=https://survey.example.com k6 run tests/loadtest/smoke.js
//
// Thresholds enforce track-3 SLOs (p95<1.5s, p99<3s, error rate<1%). Failing
// thresholds make the run exit non-zero so CI / cron can alert.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';

export const options = {
  scenarios: {
    smoke: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '40s', target: 10 },
        { duration: '10s', target: 0 },
      ],
      gracefulStop: '15s',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:live}':   ['p(95)<200',  'p(99)<500'],
    'http_req_duration{endpoint:ready}':  ['p(95)<500',  'p(99)<1500'],
    'http_req_duration{endpoint:login}':  ['p(95)<1500', 'p(99)<3000'],
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  const r1 = http.get(`${BASE_URL}/api/health/live`, { tags: { endpoint: 'live' } });
  check(r1, { 'live 200': (r) => r.status === 200 });

  const r2 = http.get(`${BASE_URL}/api/health/ready`, { tags: { endpoint: 'ready' } });
  check(r2, { 'ready 200': (r) => r.status === 200 });

  const r3 = http.get(`${BASE_URL}/login`, { tags: { endpoint: 'login' } });
  check(r3, { 'login 200': (r) => r.status === 200 });

  sleep(1);
}

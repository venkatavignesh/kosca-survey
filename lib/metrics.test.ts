import { describe, it, expect } from 'vitest';
import {
  httpRequestsTotal,
  httpRequestDurationMs,
  auditWritesTotal,
  recordHttp,
  renderMetrics,
} from './metrics';

describe('metrics', () => {
  it('records http counter with route/method/status labels', () => {
    recordHttp('/api/x', 'GET', 200, 35);
    const out = renderMetrics();
    expect(out).toContain('http_requests_total{route="/api/x",method="GET",status="200"} 1');
  });

  it('accumulates counts on repeat record', () => {
    recordHttp('/api/y', 'POST', 201, 10);
    recordHttp('/api/y', 'POST', 201, 10);
    expect(renderMetrics()).toContain('http_requests_total{route="/api/y",method="POST",status="201"} 2');
  });

  it('emits histogram buckets, sum and count', () => {
    recordHttp('/api/z', 'GET', 200, 17);
    const out = renderMetrics();
    expect(out).toMatch(/http_request_duration_ms_bucket\{[^}]*le="25"/);
    expect(out).toMatch(/http_request_duration_ms_bucket\{[^}]*le="\+Inf"/);
    expect(out).toMatch(/http_request_duration_ms_sum\{/);
    expect(out).toMatch(/http_request_duration_ms_count\{/);
  });

  it('exposes audit_writes_total', () => {
    auditWritesTotal.inc({ action: 'TEST_ACTION' });
    expect(renderMetrics()).toContain('audit_writes_total{action="TEST_ACTION"} 1');
  });

  it('escapes label values with quotes / newlines', () => {
    httpRequestsTotal.inc({ route: 'has"quote', method: 'GET', status: '200' });
    expect(renderMetrics()).toContain('route="has\\"quote"');
  });

  it('renders TYPE comments for prometheus', () => {
    const out = renderMetrics();
    expect(out).toContain('# TYPE http_requests_total counter');
    expect(out).toContain('# TYPE http_request_duration_ms histogram');
  });
});

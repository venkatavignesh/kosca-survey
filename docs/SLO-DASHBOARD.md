# SLO dashboard

Grafana / any-Prometheus-compatible dashboard. Point your Prometheus scraper at `/api/metrics` (every 15 s is fine).

## Panels (one per row)

### 1. Request rate (last 5m)
```
sum by (route) (rate(http_requests_total[5m]))
```

### 2. Error rate
```
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))
```
**Alert:** > 0.01 for 5 min (1% error budget).

### 3. Latency p50 / p95 / p99
```
histogram_quantile(0.50, sum by (le, route) (rate(http_request_duration_ms_bucket[5m])))
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_ms_bucket[5m])))
histogram_quantile(0.99, sum by (le, route) (rate(http_request_duration_ms_bucket[5m])))
```
**Alert:** p95 > 1500 ms or p99 > 3000 ms for 10 min.

### 4. Audit write rate by action
```
sum by (action) (rate(audit_writes_total[5m]))
```
Watch for `EMPLOYEE_IMPORT` spikes (mass uploads), `CAMPAIGN_DELETE` (rare; alert on > 0 outside change windows).

### 5. Readiness flap
```
probe_success{instance="https://your-host/api/health/ready"}
```
Use blackbox_exporter or any uptime probe.

## Alert sinks

Set `ALERT_WEBHOOK_URL` in `.env`. The `/api/internal/alert-check` route reads
metrics every 5 min (driven by the cron container) and posts to that webhook
when the error-rate / latency thresholds are tripped. Slack / Discord
incoming-webhook URLs accept the payload directly.

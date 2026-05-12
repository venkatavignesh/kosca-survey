// Lightweight Prometheus exposition. No external dependency.
//
// We track: HTTP request count/duration by route+method+status, audit-log
// write count, and Node-runtime defaults. The /api/metrics endpoint dumps the
// text-format these registers maintain.
//
// For a single-instance deployment this is enough. Multi-instance: replace
// the in-memory registers with prom-client (which supports cluster aggregation).

type LabelMap = Record<string, string>;

class Counter {
  private values = new Map<string, number>();
  constructor(public name: string, public help: string, public labelKeys: string[] = []) {}
  inc(labels: LabelMap = {}, by = 1) {
    const k = serialize(this.labelKeys, labels);
    this.values.set(k, (this.values.get(k) ?? 0) + by);
  }
  render(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    for (const [k, v] of this.values) {
      out += `${this.name}${k} ${v}\n`;
    }
    return out;
  }
}

class Histogram {
  private buckets: number[];
  private counts = new Map<string, number[]>();
  private sums = new Map<string, number>();
  private totals = new Map<string, number>();
  constructor(
    public name: string,
    public help: string,
    public labelKeys: string[] = [],
    bucketsMs: number[] = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  ) {
    this.buckets = bucketsMs;
  }
  observe(labels: LabelMap, ms: number) {
    const k = serialize(this.labelKeys, labels);
    let arr = this.counts.get(k);
    if (!arr) {
      arr = new Array(this.buckets.length).fill(0);
      this.counts.set(k, arr);
    }
    for (let i = 0; i < this.buckets.length; i++) {
      if (ms <= this.buckets[i]) arr[i] += 1;
    }
    this.sums.set(k, (this.sums.get(k) ?? 0) + ms);
    this.totals.set(k, (this.totals.get(k) ?? 0) + 1);
  }
  render(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    for (const [k, arr] of this.counts) {
      for (let i = 0; i < this.buckets.length; i++) {
        const lbl = withExtraLabel(k, 'le', String(this.buckets[i]));
        out += `${this.name}_bucket${lbl} ${arr[i]}\n`;
      }
      out += `${this.name}_bucket${withExtraLabel(k, 'le', '+Inf')} ${this.totals.get(k) ?? 0}\n`;
      out += `${this.name}_sum${k} ${this.sums.get(k) ?? 0}\n`;
      out += `${this.name}_count${k} ${this.totals.get(k) ?? 0}\n`;
    }
    return out;
  }
}

function serialize(keys: string[], labels: LabelMap): string {
  if (!keys.length) return '';
  return '{' + keys.map((k) => `${k}="${escape(labels[k] ?? '')}"`).join(',') + '}';
}
function withExtraLabel(existing: string, k: string, v: string): string {
  const inner = `${k}="${escape(v)}"`;
  if (!existing) return `{${inner}}`;
  return existing.slice(0, -1) + ',' + inner + '}';
}
function escape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export const httpRequestsTotal = new Counter(
  'http_requests_total',
  'Total HTTP requests by route, method, status',
  ['route', 'method', 'status'],
);
export const httpRequestDurationMs = new Histogram(
  'http_request_duration_ms',
  'HTTP request duration in milliseconds',
  ['route', 'method', 'status'],
);
export const auditWritesTotal = new Counter(
  'audit_writes_total',
  'AuditLog rows written by action',
  ['action'],
);

export function recordHttp(route: string, method: string, status: number, ms: number) {
  const labels = { route, method, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDurationMs.observe(labels, ms);
}

export function renderMetrics(): string {
  return [httpRequestsTotal.render(), httpRequestDurationMs.render(), auditWritesTotal.render()].join('\n');
}

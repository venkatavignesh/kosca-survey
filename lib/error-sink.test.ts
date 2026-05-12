import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('reportError', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.ERROR_SINK_URL;

  beforeEach(() => {
    vi.resetModules();
    global.fetch = originalFetch;
    process.env.ERROR_SINK_URL = originalEnv;
  });

  it('is a no-op when ERROR_SINK_URL is unset', async () => {
    delete process.env.ERROR_SINK_URL;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;
    const { reportError } = await import('./error-sink');
    reportError({ message: 'boom' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts JSON to the configured sink', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example.com/hook';
    const fetchSpy = vi.fn().mockResolvedValue(new Response('ok'));
    global.fetch = fetchSpy as any;
    const { reportError } = await import('./error-sink');
    reportError({ message: 'fail', requestId: 'r1', level: 'error' });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://sink.example.com/hook');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      service: 'kosca-survey',
      message: 'fail',
      requestId: 'r1',
      level: 'error',
    });
  });

  it('swallows network errors silently', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example.com/hook';
    global.fetch = vi.fn().mockRejectedValue(new Error('econnreset')) as any;
    const { reportError } = await import('./error-sink');
    expect(() => reportError({ message: 'boom' })).not.toThrow();
  });
});

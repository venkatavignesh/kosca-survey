import { describe, it, expect, vi } from 'vitest';
import { ApiError, apiHandler, errorResponse } from './errors';
import { ZodError, z } from 'zod';

vi.mock('next/headers', () => ({
  headers: () => ({ get: () => 'req-xyz' }),
}));

describe('errors', () => {
  describe('ApiError', () => {
    it('preserves status, code, and message', () => {
      const e = new ApiError(409, 'CONFLICT', 'dup');
      expect(e.status).toBe(409);
      expect(e.code).toBe('CONFLICT');
      expect(e.message).toBe('dup');
    });
  });

  describe('errorResponse', () => {
    it('returns a JSON envelope', async () => {
      const res = await errorResponse(404, 'NOT_FOUND', 'gone');
      const body = await res.json();
      expect(res.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.requestId).toBe('req-xyz');
    });
  });

  describe('apiHandler', () => {
    it('passes through happy-path responses', async () => {
      const wrapped = apiHandler(async () => new Response('hi'));
      const r = await wrapped(new Request('http://t/'), {} as never);
      expect(await r.text()).toBe('hi');
    });

    it('maps ApiError to its envelope', async () => {
      const wrapped = apiHandler(async () => {
        throw new ApiError(403, 'FORBIDDEN', 'no');
      });
      const r = await wrapped(new Request('http://t/'), {} as never);
      expect(r.status).toBe(403);
      const body = await r.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('maps ZodError to INVALID_INPUT', async () => {
      const schema = z.object({ name: z.string() });
      const wrapped = apiHandler(async () => {
        schema.parse({ name: 123 });
        return new Response();
      });
      const r = await wrapped(new Request('http://t/'), {} as never);
      expect(r.status).toBe(400);
      const body = await r.json();
      expect(body.error.code).toBe('INVALID_INPUT');
    });

    it('maps unknown errors to INTERNAL 500', async () => {
      const wrapped = apiHandler(async () => {
        throw new Error('boom');
      });
      const r = await wrapped(new Request('http://t/'), {} as never);
      expect(r.status).toBe(500);
      const body = await r.json();
      expect(body.error.code).toBe('INTERNAL');
    });
  });
});
